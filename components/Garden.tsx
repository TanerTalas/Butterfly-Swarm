'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Meadow,
  useMeadowBridge,
  type MeadowStatus,
} from '@/components/meadow/Meadow';
import {
  MeadowShell,
  ReleaseCounter,
  SceneNotice,
} from '@/components/meadow/MeadowShell';
import {
  AccountChip,
  FarewellView,
  MemberMeadow,
} from '@/components/meadow/MemberViews';
import { Button } from '@/components/ui/Button';
import { GuestReleaseCard } from '@/components/release/GuestReleaseCard';
import { ReleasedView } from '@/components/release/ReleasedView';
import { WingsCard } from '@/components/release/WingsCard';
import { SignInCard } from '@/components/account/SignInCard';
import { SetupCard } from '@/components/account/SetupCard';
import { AccountCard } from '@/components/account/AccountCard';
import { SettingsCard } from '@/components/account/SettingsCard';
import { MyButterfliesCard } from '@/components/butterflies/MyButterfliesCard';
import { HistoryCard } from '@/components/butterflies/HistoryCard';
import {
  StopWatchingButton,
  WatchButton,
} from '@/components/meadow/WatchButton';
import { clearDraft } from '@/lib/draft';
import { isNoticeDismissed, dismissNotice } from '@/lib/dismissed';
import {
  expiresAt,
  GUEST_DAILY_LIMIT,
  SLOT_LIMIT,
  WING_COLOURS,
  type Butterfly,
  type Profile,
  type ReleaseFailure,
  type Session,
  type SignInError,
} from '@/lib/types';
import {
  completeSetup,
  signIn as signInAction,
  signOut as signOutAction,
  signUp as signUpAction,
} from '@/app/actions/auth';

/*
 * Bahçe — tek sayfanın durum makinesi.
 *
 * Yasal sayfalar dışında hiçbir şey gerçek bir rota değil. Çayır HİÇ unmount
 * olmuyor; yalnızca üstündeki kart değişiyor. Bu yüzden görünüm durumu
 * burada, sahnenin dışında ve üstünde duruyor.
 *
 * ⚠ SUNUCU YOK. Oturum, kelebek listesi ve sayaç bu bileşenin içinde yaşıyor
 * ve sayfa yenilenince sıfırlanıyor. Handoff'un kuralı net: sunucu tavanın,
 * ömrün ve sayacın sahibi; istemci uygunluk hesaplamıyor. Buradaki
 * kontroller yalnızca arayüzü gezilebilir kılmak için. Aşama C'de
 * `releaseAsGuest`, `completeSignIn` gibi fonksiyonlar birer sunucu
 * çağrısına dönüşecek, ekranlar aynı kalacak.
 */

type View =
  | 'landing'
  | 'guest-release'
  | 'released'
  | 'signin'
  | 'setup'
  | 'meadow'
  | 'wings'
  | 'butterflies'
  | 'account'
  | 'settings'
  | 'history'
  | 'farewell';

export function Garden({
  initialTotal = 0,
  initialSession = { kind: 'guest' },
}: {
  initialTotal?: number;
  /**
   * Sunucunun okuduğu oturum (`app/page.tsx` → `readSession()`).
   *
   * ⚠ Oturum İLK RENDER'da biliniyor, sonradan bir effect'le sorulmuyor.
   * Sorulsaydı sayfa önce misafir hâlinde çizilir, sonra üye hâline
   * sıçrardı — yenilemede her seferinde görünen bir titreme.
   */
  initialSession?: Session;
}) {
  /*
   * Açılış ekranı OTURUMDAN geliyor.
   *
   * Hesap kurulumunu yarıda bırakıp yenileyen biri `setup`ta devam ediyor;
   * `landing`e düşseydi hesabı var ama girilemeyen bir hâlde kalırdı. Doğrulama
   * bağlantısından gelen kullanıcı da buraya iniyor (`/auth/confirm` oturumu
   * kurup `/`'e bırakıyor).
   */
  const [view, setView] = useState<View>(() =>
    initialSession.kind === 'incomplete'
      ? 'setup'
      : initialSession.kind === 'member'
        ? 'meadow'
        : 'landing',
  );

  /*
   * Geri donus yigini.
   *
   * Her ekranin sabit bir "ustu" yok: kanat secimine cayirdan da,
   * kelebeklerim listesinden de gelinebiliyor ve geri tusu dogru yere
   * donmeli. Sabit esleme yazmak yerine gezinme gecmisi tutuluyor.
   *
   * Tarayici gecmisi kullanilmiyor: burasi tek sayfa ve gercek rota degisimi
   * yok (yalnizca yasal sayfalar rota). Adres cubuguna kart durumlari yazmak
   * sahnenin yeniden kurulmasina yol acardi.
   */
  const [history, setHistory] = useState<View[]>([]);
  const [total, setTotal] = useState(initialTotal);
  const [pending, setPending] = useState(false);

  /*
   * Reddedilen salma ve reddedilen giriş (D3-2 / D4 / D5 / D6).
   *
   * ⚠ Bunlara SUNUCU karar verecek; istemci uygunluk hesaplamıyor. Bugün
   * hiçbiri kendiliğinden oluşmuyor — `failNext` ile denenebiliyorlar
   * (aşağıdaki geliştirme kancası). Aşama C'de `releaseAsGuest` /
   * `completeSignIn` birer sunucu çağrısına dönüştüğünde cevabı buraya
   * yazacaklar; kartlar aynı kalacak.
   */
  const [releaseFailure, setReleaseFailure] =
    useState<ReleaseFailure | null>(null);
  const [signInError, setSignInError] = useState<SignInError | null>(null);

  /*
   * Bir sonraki denemeyi ZORLA düşürecek hata. Geliştirme kancası yazıyor,
   * deneme onu okuyup TÜKETİYOR — bir kez düşüp geçmesi gerekiyor, yoksa
   * ekran bir daha çalışmaz hâle gelir.
   */
  const forcedFailure = useRef<ReleaseFailure | SignInError | null>(null);

  /*
   * Profil oturumdan başlıyor. `incomplete` hâlinde İSMİ BOŞ bir profil
   * kuruluyor: `setup` ekranı e-postayı gösterebilsin diye. `signedIn` ismin
   * dolu olmasına baktığı için bu kullanıcı henüz üye sayılmıyor.
   */
  const [profile, setProfile] = useState<Profile | null>(() =>
    initialSession.kind === 'member'
      ? initialSession.profile
      : initialSession.kind === 'incomplete'
        ? { name: '', email: initialSession.email, avatarHex: '#4F7FBF' }
        : null,
  );

  /** Kayıt alındı, doğrulama postası yolda — `SignInCard status="verify"`. */
  const [awaitingVerify, setAwaitingVerify] = useState(false);

  const [butterflies, setButterflies] = useState<Butterfly[]>([]);
  const [lastReleased, setLastReleased] = useState<Butterfly | null>(null);
  const [expired, setExpired] = useState<Butterfly | null>(null);

  /*
   * Girişten sonra nereye dönüleceği. Handoff'un 2 numaralı değişikliği:
   * misafir "sign in to choose the wing colours" derse, giriş bittiğinde
   * karşılama ekranına değil salma adımına dönmeli.
   */
  const [afterSignIn, setAfterSignIn] = useState<View>('meadow');

  /*
   * Izleme kipi: arayuz tamamen cekiliyor ve yalnizca sahne kaliyor.
   * Kartlarin ustunde degil, kabugun tamaminin ustunde bir anahtar —
   * cikis icin alt ortada acik bir dugme birakiliyor.
   *
   * İki ayrı giriş var ve ikisi farklı şey yapıyor:
   *
   *   "Watch the meadow"        → serbest bakış, kamera kimseyi izlemiyor
   *   satırdaki "Watch" / follow → kamera O kelebeğe taşınıyor
   *
   * `watched` bu ayrımı taşıyor: null serbest bakış demek.
   */
  const [watching, setWatching] = useState(false);
  const [watched, setWatched] = useState<string | null>(null);

  /*
   * Sahnenin durumu ve "çayır çizilemiyor" şeridi (D8).
   *
   * Durum sahnede doğuyor ama şerit KABUKTA çiziliyor: sayaç ve rozetle aynı
   * akışta durunca hiçbir genişlikte çakışamıyor. Eskiden sahne katmanına
   * mutlak konumla yapıştırılmıştı ve 390px'te sayacın üstüne biniyordu.
   */
  const [sceneStatus, setSceneStatus] = useState<MeadowStatus>('loading');
  const [noticeHidden, setNoticeHidden] = useState(true);

  /*
   * Kapatılmışlık MONTAJDAN SONRA okunuyor, `useState` başlangıcında değil:
   * sunucu depoyu göremez ve istemcinin ilk render'ı ondan farklı çizerse
   * hidrasyon uyuşmazlığı olur (taslakla aynı tuzak, bkz. `lib/draft.ts`).
   * Bu yüzden başlangıç `true` — şerit bir kare gecikmeyle beliriyor, ki
   * sahne zaten o kareden sonra hazır oluyor.
   */
  useEffect(() => {
    setNoticeHidden(isNoticeDismissed());
  }, []);

  const showSceneNotice = sceneStatus === 'unsupported' && !noticeHidden;

  function startWatching(id: string | null) {
    setWatched(id);
    setWatching(true);
  }

  function stopWatching() {
    setWatching(false);
    setWatched(null);
  }

  /*
   * Ömrünü tamamlamış kelebekler — History ekranının kaynağı.
   *
   * Gezinme yığını da `history` adını taşıdığı için burası `finished`:
   * ikisi tamamen farklı şeyler ve karışmaları kolay.
   *
   * ⚠ Sunucu gelene kadar boş. Ayrıca gizlilik metniyle çelişiyor: orada
   * yedi günü dolan kaydın silindiği yazıyor, geçmiş listesi ise onu
   * saklamayı gerektiriyor. Aşama C'de ya metin ya saklama düzeltilmeli.
   */
  const [finished] = useState<Butterfly[]>([]);

  /*
   * Misafirin bugün kaç kelebek saldığı.
   *
   * ⚠ Yalnızca arayüzün doğru şeyi söylemesi için. Gerçek sınır sunucuda,
   * IP başına uygulanacak; buradaki sayaç sayfa yenilenince sıfırlanıyor,
   * yani bir korumadan çok bir bilgi.
   */
  const [guestReleasesToday, setGuestReleasesToday] = useState(0);
  const guestBlocked = guestReleasesToday >= GUEST_DAILY_LIMIT;

  /*
   * Misafir kelebekleri.
   *
   * `butterflies` listesinden AYRI duruyorlar ve bu bilinçli: misafirin
   * kelebeği kimseye ait değil, "kelebeklerim"de görünmüyor, takip
   * edilemiyor ve beş yuvadan birini yemiyor. Ama çayırda uçuyor —
   * sahne için ikisi arasında hiçbir fark yok.
   */
  const [guestButterflies, setGuestButterflies] = useState<Butterfly[]>([]);

  const signedIn = profile !== null && profile.name.length > 0;
  const flyingNow = butterflies.length;

  /*
   * Çayır köprüsü. Salınan kelebeğin sahneye çıktığı tek yol.
   *
   * Aşağıdaki effect BİLDİRİMSEL: "şu an çayırda bunlar olmalı" diyor.
   * Ekleme/çıkarma farkını köprü hesaplıyor, çünkü sahne asenkron yükleniyor
   * ve kullanıcı o inmeden de kelebek salabiliyor (bkz. Meadow.tsx).
   */
  const meadow = useMeadowBridge();

  useEffect(() => {
    /*
     * Ömrün bitiş anı burada EKLENİYOR, sahnede hesaplanmıyor: kaç günlük
     * bir ömür olduğu bir ürün kuralı ve `lib/types.ts`te duruyor. Sahne
     * yalnızca iki mutlak an görüyor ve aradaki oranı çiziyor.
     */
    meadow.sync([
      ...butterflies.map((b) => ({
        ...b,
        kind: 'member' as const,
        expiresAt: expiresAt(b),
      })),
      ...guestButterflies.map((b) => ({
        ...b,
        kind: 'guest' as const,
        expiresAt: expiresAt(b),
      })),
    ]);
  }, [meadow, butterflies, guestButterflies]);

  /*
   * Kameranın izlediği kelebek. Ayrı bir effect, çünkü listeden bağımsız
   * değişiyor: kart kapanıp izleme kipine geçmek listeyi hiç ilgilendirmiyor.
   */
  useEffect(() => {
    meadow.watch(watching ? watched : null);
  }, [meadow, watching, watched]);

  /*
   * ── Geliştirme kancası ──────────────────────────────────────────────────
   *
   * D1 ve D3-2/D4/D5/D6 hiçbiri kendiliğinden OLUŞMUYOR: birincisi için
   * hesabın hiç kelebeği olmaması, diğerleri için reddeden bir sunucu
   * gerekiyor ve ikisi de bugün yok. Tasarlanmış ama hiç çizilmeyen bir
   * durum, çizilmemiş bir durumdur — bu kanca onları tarayıcı konsolundan
   * açılabilir yapıyor:
   *
   *     __garden.failNext({ kind: 'slots-full' })   sonraki salma reddedilsin
   *     __garden.failNext({ kind: 'credentials' })  sonraki giriş reddedilsin
   *     __garden.clearButterflies()                 D1: liste boşalsın
   *     __garden.sceneStatus('unsupported')         D8: çayır çizilemiyor
   *     __garden.sceneStatus('ready')               geri al
   *
   * Üretimde HİÇ derlenmiyor: `process.env.NODE_ENV` Next tarafından sabit
   * olarak değiştiriliyor ve blok tamamen eleniyor.
   */
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    const w = window as unknown as Record<string, unknown>;
    w.__garden = {
      failNext(failure: ReleaseFailure | SignInError) {
        forcedFailure.current = failure;
      },
      clearButterflies() {
        setButterflies([]);
      },
      /*
       * Sahne durumunu elle kur. WebGL'i olan bir tarayıcıda D8'e başka
       * türlü girilemiyor ve bunun için kodu düzenleyip geri almak, tam
       * olarak unutulup açık kalan türden bir iş.
       *
       * Kapatılmışlığı EZMİYOR: şerit bu sekmede kapatıldıysa yine
       * görünmüyor — yoksa kanca, doğrulamak istediğimiz davranışın
       * kendisini gizlerdi. Yeniden görmek için depo anahtarını silip
       * sayfayı yenile (`butterfly-garden:scene-notice-dismissed`).
       */
      sceneStatus(next: MeadowStatus) {
        setSceneStatus(next);
      },
    };
    return () => {
      delete w.__garden;
    };
  }, []);

  /*
   * Reddin ömrü DENEMENİN ömrü kadar.
   *
   * Kart terk edildiğinde red de gitmeli: kullanıcı çayıra dönüp geri
   * geldiğinde bu artık başka bir ziyaret ve o an geçerli olup olmadığını
   * yalnızca sunucu bilir. Ekranda bırakmak, bir daha sorulmamış bir sorunun
   * eski cevabını göstermek olurdu — en görünür hâliyle: ağ hatası
   * düzeldikten sonra bile buton hâlâ "olmadı" diyor.
   */
  function clearAttempts() {
    setReleaseFailure(null);
    setSignInError(null);
  }

  /** Yeni ekrana gec ve gecmise ekle. */
  function go(next: View) {
    clearAttempts();
    setHistory((h) => [...h, view]);
    setView(next);
  }

  /** Bir onceki ekrana don. Gecmis bossa koke. */
  function back() {
    clearAttempts();
    setHistory((h) => {
      const prev = h[h.length - 1];
      setView(prev ?? (signedIn ? 'meadow' : 'landing'));
      return h.slice(0, -1);
    });
  }

  /** Akis bitti: gecmisi temizleyip yeni bir kok ekrana gec. */
  function reset(next: View) {
    clearAttempts();
    setHistory([]);
    setView(next);
  }

  async function fakeDelay() {
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, 420));
    setPending(false);
  }

  /**
   * Zorlanmış hatayı okur ve TÜKETİR.
   *
   * Tüketmek şart: kalsaydı bir kez denenen hata kalıcı olur ve ekran bir
   * daha salamaz hâle gelirdi.
   */
  function takeForcedFailure<T>(): T | null {
    const f = forcedFailure.current as T | null;
    forcedFailure.current = null;
    return f;
  }

  async function releaseAsGuest() {
    // Yeni deneme, temiz sayfa: önceki red ekranda kalmamalı
    setReleaseFailure(null);
    await fakeDelay();

    const failure = takeForcedFailure<ReleaseFailure>();
    if (failure) {
      setReleaseFailure(failure);
      return;
    }

    /*
     * Rengi ÇAYIR seçiyor — kartın sözü bu ("The meadow picks the wings").
     * Tek renk: ön ve arka kanat aynı. İki renkli kanat kayıtlı
     * kullanıcılara özel, yerleşik ve misafir kelebekler paletten tek renk
     * geziyor (projefikri.md §2).
     *
     * ⚠ Çekiliş sunucuya taşınacak. Burada olduğu sürece kullanıcı yeniden
     * deneyerek istediği rengi tutturabilir.
     */
    const colour =
      WING_COLOURS[Math.floor(Math.random() * WING_COLOURS.length)].hex;

    const butterfly: Butterfly = {
      id: newId(),
      name: null,
      foreHex: colour,
      hindHex: colour,
      releasedAt: new Date(),
    };

    setGuestButterflies((list) => [...list, butterfly]);
    setLastReleased(butterfly);
    setTotal((n) => n + 1);
    setGuestReleasesToday((n) => n + 1);
    reset('released');
  }

  async function releaseAsMember(name: string, fore: string, hind: string) {
    setReleaseFailure(null);
    await fakeDelay();

    const failure = takeForcedFailure<ReleaseFailure>();
    if (failure) {
      setReleaseFailure(failure);
      return;
    }

    const butterfly: Butterfly = {
      id: newId(),
      name,
      foreHex: fore,
      hindHex: hind,
      releasedAt: new Date(),
    };
    setButterflies((list) => [...list, butterfly]);
    setLastReleased(butterfly);
    setTotal((n) => n + 1);

    /*
     * Taslak artık bir KELEBEK. Silme burada, kartta değil: salmanın
     * gerçekten olduğunu bilen tek yer burası — kart yalnızca istekte
     * bulunuyor ve reddedilen bir istekten sonra taslağın durması şart
     * (D4/D5'in "renkleriniz ve isminiz duruyor" sözü).
     */
    clearDraft();
    reset('released');
  }

  async function completeSignIn(email: string, password: string) {
    const failure = takeForcedFailure<SignInError>();
    if (failure) {
      setSignInError(failure);
      return;
    }

    setPending(true);
    const result = await signInAction(email, password);
    setPending(false);

    if (!result.ok) {
      setSignInError(result.error);
      return;
    }

    /*
     * Hesap kurulumu yarım kalmışsa oraya. Profil İSMİ BOŞ kuruluyor; `setup`
     * ekranı e-postayı gösteriyor ve `signedIn` false kalıyor.
     */
    if (result.session === 'incomplete') {
      setProfile({ name: '', email: result.email, avatarHex: '#4F7FBF' });
      reset('setup');
      return;
    }

    setProfile(result.profile);
    reset(afterSignIn);
  }

  /*
   * Kayıt.
   *
   * ⚠ Doğrudan hesap kurulumuna GİTMİYOR — doğrulama ekranına gidiyor. Hesap
   * açıldı ama e-postası doğrulanana kadar giriş yapamıyor; kurulum, bağlantıya
   * tıklandıktan sonra (`/auth/confirm` → `/` → oturum `incomplete`) geliyor.
   *
   * ⚠ Zaten kayıtlı bir e-posta da BURAYA düşüyor ve ekran hiçbir fark
   * göstermiyor. Kasıtlı: "bu e-posta zaten kayıtlı" demek, girişteki tek mesaj
   * kuralını arka kapıdan delerdi. Fark yalnızca posta kutusunda.
   */
  async function startSignUp(email: string, password: string) {
    const failure = takeForcedFailure<SignInError>();
    if (failure) {
      setSignInError(failure);
      return;
    }

    setPending(true);
    const result = await signUpAction(email, password);
    setPending(false);

    if (!result.ok) {
      setSignInError(result.error);
      return;
    }

    setProfile({ name: '', email, avatarHex: '#4F7FBF' });
    setAwaitingVerify(true);
  }

  /*
   * ⚠ Kelebekleri listeden düşüren satır HÂLÂ BURADA ve hâlâ yanlış: salınan
   * kelebek çayırın, salanın değil — oturum kapansa da uçmaya devam etmeli.
   *
   * Kalkamamasının sebebi listenin kaynağı: kelebekler hâlâ yalnızca bu
   * bileşenin belleğinde yaşıyor, yani çıkışta boşaltılmasalar da yenilemede
   * kayboluyorlar. Liste sunucudan gelmeye başladığında (E.3) bu iki satır
   * birlikte kalkacak.
   */
  async function signOut() {
    setProfile(null);
    setButterflies([]);
    setAwaitingVerify(false);
    reset('landing');
    await signOutAction();
  }

  function deleteAccount() {
    // Kelebekler anında çayırdan kalkıyor — uyarıda söz verilen davranış.
    // Burada listeyi boşaltmak yetiyor: köprü farkı görüp sahneden kaldırıyor.
    setProfile(null);
    setButterflies([]);
    reset('landing');
  }

  /** Salmaya git. Yuvalar doluysa listeye düşürüp nedenini gösteriyor. */
  function goRelease() {
    if (!signedIn) {
      go('guest-release');
      return;
    }
    go(flyingNow >= SLOT_LIMIT ? 'butterflies' : 'wings');
  }

  /*
   * ── Kart geçişlerinde odak (§6.3) ───────────────────────────────────────
   *
   * Burası tek sayfa ve gerçek bir rota değişimi yok: kart değişince
   * tarayıcı odağı taşımıyor, çünkü tarayıcıya göre hiçbir şey olmadı. Sekme
   * tuşuyla gezen biri "Release a butterfly"a basıp yeni karta geçtiğinde
   * odak hâlâ artık var olmayan bir düğmedeydi, yani BODY'ye düşüyordu ve
   * bir sonraki Tab onu sayfanın en başına götürüyordu.
   *
   * Çözüm gezinme çerçevesinin odaklanabilir olması: sarmalayıcı `view`
   * değiştiğinde zaten yeniden kuruluyor (`key={view}`), o yüzden odak
   * doğal olarak yeni kartın başına düşüyor ve Tab oradan devam ediyor.
   *
   * Üç şey bilerek:
   *
   *   - **İlk render'da odak ÇALINMIYOR.** Sayfa açıldığında kullanıcı
   *     henüz bir yere gitmedi; açılışta odağı kaçırmak hem şaşırtıyor hem
   *     de ekran okuyucunun sayfa başlığını okumasını kesiyor.
   *   - **İzleme kipinde atlanıyor**, çünkü kabuk o sırada `inert` ve inert
   *     bir ağaçtaki elemana odak verilemiyor — çağrı sessizce düşerdi.
   *     Bağımlılıkta `watching` var, yani izlemeden ÇIKINCA odak karta geri
   *     dönüyor; eskiden "Leave the meadow" düğmesi kaybolunca odak da
   *     kayboluyordu.
   *   - **`preventScroll`**: kabuğun kaydırma kabı ekranın kendisi
   *     (bkz. MeadowShell) ve odak verirken tarayıcının kendiliğinden
   *     kaydırması kartı geçiş animasyonunun ortasında sıçratıyordu.
   */
  const viewRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    /*
     * İzleme kipinde odak ÇIKIŞ DÜĞMESİNE gidiyor, karta değil.
     *
     * Kabuk o sırada `inert` ama odak kendiliğinden dışarı çıkmıyor: Chrome,
     * odaklı bir elemanın atası sonradan `inert` olduğunda odağı bırakmıyor
     * (ölçüldü). Sonuç, kullanıcının göremediği ve etkileşemediği bir yerde
     * duran bir odak — oradan Tab'a basmak bütün turu dolaşıp geliyordu,
     * çünkü çıkış düğmesi DOM'da kabuktan ÖNCE duruyor.
     *
     * İzleme kipinde ekranda tek bir denetim var ve klavyeyle gezen birinin
     * ihtiyacı olan tam olarak o.
     */
    if (watching) {
      exitRef.current?.focus({ preventScroll: true });
      return;
    }

    viewRef.current?.focus({ preventScroll: true });
  }, [view, watching]);

  const onMeadowView = view === 'landing' || view === 'meadow';

  return (
    <main className="meadow-stage">
      <Meadow bridge={meadow} onStatus={setSceneStatus} />

      {watching && <StopWatchingButton ref={exitRef} onClick={stopWatching} />}

      <MeadowShell
        hidden={watching}
        notice={
          showSceneNotice ? (
            <SceneNotice
              onDismiss={() => {
                setNoticeHidden(true);
                dismissNotice();
              }}
            />
          ) : null
        }
        scrim={view === 'settings' || view === 'farewell' ? 'heavy' : 'default'}
        counter={onMeadowView ? <ReleaseCounter total={total} /> : null}
        aside={
          onMeadowView ? (
            <WatchButton onClick={() => startWatching(null)} />
          ) : null
        }
        /*
         * Yasal şerit YALNIZCA çayır görünümlerinde. Kart ekranlarında
         * kartla aynı sütunda duruyor ve ekrana sığmayan bir kartı
         * yukarı itip kesilmesine yol açıyordu (bkz. MeadowShell).
         */
        legal={onMeadowView}
        topRight={
          signedIn && profile ? (
            <AccountChip profile={profile} onClick={() => go('account')} />
          ) : null
        }
      >
        {/*
         * `tabIndex={-1}`: odak PROGRAMLA veriliyor, Tab sırasına girmiyor.
         * Sekmeyle gezen biri bu kutuda takılmamalı — burası bir denetim
         * değil, yalnızca odağın konacağı yer.
         */}
        <div key={view} ref={viewRef} tabIndex={-1} className="view-fade">
          {view === 'landing' && (
            <Landing
              onRelease={() => go('guest-release')}
              onSignIn={() => {
                setAfterSignIn('meadow');
                go('signin');
              }}
            />
          )}

          {view === 'guest-release' && (
            <GuestReleaseCard
              pending={pending}
              blocked={guestBlocked}
              failure={releaseFailure}
              onRelease={releaseAsGuest}
              onBack={back}
              onSignIn={() => {
                setAfterSignIn('wings');
                go('signin');
              }}
            />
          )}

          {view === 'signin' && (
            <SignInCard
              error={signInError}
              pending={pending}
              status={awaitingVerify ? 'verify' : 'idle'}
              onAttempt={() => setSignInError(null)}
              onDone={completeSignIn}
              onBack={back}
              onNeedsSetup={startSignUp}
            />
          )}

          {view === 'setup' && profile && (
            <SetupCard
              email={profile.email}
              onBack={back}
              onDone={async (name, avatarHex) => {
                const result = await completeSetup(name, avatarHex);

                /*
                 * Reddedilirse ekranda kalınıyor. Kurulumun tek reddedilme yolu
                 * oturumun düşmüş olması ve o hâlde ileri gitmek, isimsiz bir
                 * profille çayıra girmek demekti — kartta kalmak, kullanıcının
                 * yazdığını da koruyor.
                 */
                if (!result.ok) return;

                setProfile(result.profile);
                reset(afterSignIn);
              }}
            />
          )}

          {view === 'meadow' && (
            <MemberMeadow
              flyingNow={flyingNow}
              onRelease={goRelease}
              onMyButterflies={() => go('butterflies')}
            />
          )}

          {view === 'wings' && (
            <WingsCard
              slotsUsed={flyingNow}
              pending={pending}
              failure={releaseFailure}
              onRelease={releaseAsMember}
              onGoToList={() => go('butterflies')}
              onBack={back}
            />
          )}

          {view === 'released' && lastReleased && (
            <ReleasedView
              name={lastReleased.name}
              releasedAt={lastReleased.releasedAt}
              onMyButterflies={() => reset(signedIn ? 'butterflies' : 'signin')}
              /*
               * Misafir de takip edebiliyor — ama YALNIZCA ŞİMDİ. Kartın
               * "cannot be followed afterwards" sözü sonrasıyla ilgili:
               * misafirin listesi olmadığı için o kelebeğe bir daha
               * dönemiyor. Bu tek an elinden alınmıyor.
               */
              onWatch={() => {
                reset(signedIn ? 'meadow' : 'landing');
                startWatching(lastReleased.id);
              }}
            />
          )}

          {view === 'butterflies' && (
            <MyButterfliesCard
              butterflies={butterflies}
              historyCount={finished.length}
              onRelease={goRelease}
              onBack={back}
              onHistory={() => go('history')}
              onWatch={(b) => startWatching(b.id)}
            />
          )}

          {view === 'history' && (
            <HistoryCard butterflies={finished} onBack={back} />
          )}

          {view === 'account' && profile && (
            <AccountCard
              profile={profile}
              flyingNow={flyingNow}
              releasedTotal={total + butterflies.length}
              memberSince={new Date(2026, 5, 1)}
              onMyButterflies={() => go('butterflies')}
              onSettings={() => go('settings')}
              onSignOut={signOut}
              onBack={back}
            />
          )}

          {view === 'settings' && profile && (
            <SettingsCard
              profile={profile}
              onBack={back}
              onSave={(name, avatarHex) =>
                setProfile({ ...profile, name, avatarHex })
              }
              onDelete={deleteAccount}
            />
          )}

          {view === 'farewell' && expired && (
            <FarewellView
              name={expired.name}
              releasedAt={expired.releasedAt}
              onRelease={goRelease}
              onMyButterflies={() => reset('butterflies')}
            />
          )}
        </div>
      </MeadowShell>
    </main>
  );
}

/*
 * `crypto.randomUUID` yalnızca güvenli bağlamlarda var; localhost dışında
 * http ile açılan bir önizlemede tanımsız oluyor ve salma akışı patlıyordu.
 * Kimlikler zaten geçici — sunucu gelince gerçek id veritabanından gelecek.
 */
function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function Landing({
  onRelease,
  onSignIn,
}: {
  onRelease: () => void;
  onSignIn: () => void;
}) {
  return (
    <div className="meadow-view meadow-view--narrow">
      <p className="eyebrow">the sakura meadow</p>

      <h1 className="meadow-view-title meadow-view-title--hero">
        Butterfly Garden
      </h1>

      <p className="meadow-view-lede meadow-view-lede--narrow">
        Let one butterfly go. It flies the meadow for seven days, then the
        wind takes it.
      </p>

      <div className="action-row">
        <Button onClick={onRelease}>Release a butterfly</Button>
        <Button variant="secondary" onClick={onSignIn}>
          Sign in
        </Button>
      </div>

      {/*
       * Mobilde ORTALI (bkz. `.landing-hint`). Dar ekranda butonlar tam
       * genişlikte ve blok ekranı kaplıyor; sola yaslı tek bir satır
       * ortada asılı kalıyordu.
       */}
      <p className="eyebrow landing-hint">
        wing colours and tracking need an account
      </p>
    </div>
  );
}
