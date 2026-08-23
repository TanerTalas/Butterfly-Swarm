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
import { ForgotCard, ResetCard } from '@/components/account/ResetCards';
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
  SLOT_LIMIT,
  type AccountFacts,
  type Butterfly,
  type MeadowEntry,
  type Profile,
  type ReleaseFailure,
  type Session,
  type SignInError,
} from '@/lib/types';
import {
  deleteAccount as deleteAccountAction,
  updateProfile,
} from '@/app/actions/account';
import {
  completeSetup,
  signIn as signInAction,
  signOut as signOutAction,
  signUp as signUpAction,
} from '@/app/actions/auth';
import {
  releaseAsGuest as releaseGuestAction,
  releaseAsMember as releaseMemberAction,
} from '@/app/actions/release';
import {
  requestPasswordReset,
  resetPassword,
} from '@/app/actions/password';

/*
 * Bahçe — tek sayfanın durum makinesi.
 *
 * Yasal sayfalar dışında hiçbir şey gerçek bir rota değil. Çayır HİÇ unmount
 * olmuyor; yalnızca üstündeki kart değişiyor. Bu yüzden görünüm durumu
 * burada, sahnenin dışında ve üstünde duruyor.
 *
 * Kimlik, salma ve sayaç SUNUCUDA (`app/actions/`). İstemci uygunluk
 * hesaplamıyor: tavan, ömür, renk ve tohum hep sunucudan geliyor; buradaki
 * kontroller yalnızca butonu doğru anda kilitlemek için.
 *
 * Listelerin hepsi SUNUCUDAN geliyor ve ilk render'da hazır (`app/page.tsx`):
 * çayır, kullanıcının kendi kelebekleri, geçmiş. Buradaki durum onların
 * kopyası — yenileme onu yeniden kuruyor, yani `F5` hiçbir şeyi kaybetmiyor.
 *
 * ⚠ `meadowList` ile `butterflies` AYRI ŞEYLER. İlki çayırda ne uçtuğu
 * (herkesin, isimsiz), ikincisi kullanıcının kendi kelebekleri (isimli,
 * listelenen). Birleştirmek, birinin kelebeğine verdiği ismi bütün
 * ziyaretçilere açmak olurdu.
 */

type View =
  | 'landing'
  | 'guest-release'
  | 'released'
  | 'signin'
  | 'forgot'
  | 'reset'
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
  initialGuestUsed = false,
  initialResetPending = false,
  initialMeadow = [],
  initialButterflies = [],
  initialHistory = [],
  initialAccount = null,
}: {
  initialTotal?: number;
  /** Misafir bugünkü hakkını kullandı mı (`app/page.tsx` → `guestReleaseUsed()`). */
  initialGuestUsed?: boolean;
  /**
   * Sıfırlama çerezi duruyor mu — yani kullanıcı postadaki bağlantıdan geldi.
   *
   * Token buraya GELMİYOR, yalnızca "bir sıfırlama sürüyor" bilgisi geliyor.
   * Token `httpOnly` çerezde kalıyor ve onu okuyan tek yer sunucu.
   */
  initialResetPending?: boolean;
  /** Çayırda uçan HERKESİN kelebeği — isimsiz, sahipsiz (`readMeadow()`). */
  initialMeadow?: MeadowEntry[];
  /** Üyenin kendi uçan kelebekleri (`readOwnLive()`). */
  initialButterflies?: Butterfly[];
  /** Üyenin ömrünü tamamlamışları — isim ve tarih (`readOwnHistory()`). */
  initialHistory?: Butterfly[];
  /**
   * Hesabın kendisiyle ilgili üç değer (`readAccountFacts()`): kaç kelebek
   * salındığı, ne zamandır üye olunduğu ve profil kilidinin bittiği an.
   *
   * Misafirde null. Veritabanı susmuşsa da null — "Hesabım"daki iki sayı ve
   * ayarlardaki kilit, sayfanın açılmasını engelleyecek şeyler değil.
   */
  initialAccount?: AccountFacts | null;
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
  const [view, setView] = useState<View>(() => {
    // Sıfırlama bağlantısından gelen her şeyin önünde: hesabına giremeyen biri
    // için yapılacak tek iş bu.
    if (initialResetPending) return 'reset';
    if (initialSession.kind === 'incomplete') return 'setup';
    return initialSession.kind === 'member' ? 'meadow' : 'landing';
  });

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
   * ⚠ Bunlara SUNUCU karar veriyor; istemci uygunluk hesaplamıyor. `failNext`
   * kancası artık yalnızca ulaşması zor hâlleri denemek için duruyor —
   * `guest-limit`, `slots-full`, `meadow-full` ve `credentials` gerçekten
   * oluşabiliyor.
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

  /** Sıfırlama bağlantısı, form doldurulurken ölmüş. */
  const [resetExpired, setResetExpired] = useState(false);

  /*
   * Kullanıcının KENDİ uçan kelebekleri — "Kelebeklerim"in kaynağı ve beş
   * yuvalık sayacın dayanağı. Çayır listesinden (`meadowList`) ayrı: bu isim
   * taşıyor, o taşımıyor.
   */
  const [butterflies, setButterflies] =
    useState<Butterfly[]>(initialButterflies);
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
   * Sunucudan geliyor ve YALNIZCA isim ile tarih taşıyor: renk ve çayırdaki
   * yer, ömür dolunca gidiyor (gizlilik metninin sözü, `readOwnHistory`).
   */
  const [finished, setFinished] = useState<Butterfly[]>(initialHistory);

  /*
   * Misafir bugünkü hakkını kullandı mı — SUNUCUDAN geliyor.
   *
   * ⚠ İstemci HESAPLAMIYOR. Hak `httpOnly` bir çerezde duruyor, yani tarayıcı
   * kendisi bakamıyor bile; sunucu söylüyor (`guestReleaseUsed`). Değer ilk
   * render'da biliniyor, sonradan bir effect'le sorulmuyor — sorulsaydı buton
   * bir an açık görünüp sonra kilitlenirdi.
   */
  const [guestBlocked, setGuestBlocked] = useState(initialGuestUsed);

  /*
   * ÇAYIRIN kendisi — herkesin kelebeği, sunucudan.
   *
   * ⚠ `butterflies` ile KARIŞTIRILMAMALI ve ikisi ayrı kalmalı: bu liste
   * çayırda ne uçtuğunu söylüyor (isimsiz, sahipsiz), diğeri kullanıcının
   * kendi kelebeklerini (isimli, "Kelebeklerim"de listelenen). Bir kelebek
   * ikisinde birden olabilir; sahne yalnızca buradan besleniyor.
   *
   * Salınan kelebek buraya EKLENİYOR, liste yeniden çekilmiyor. Sebebi yem
   * kelebek kuralı: misafir kontenjanı doluyken sunucu satırı hiç yazmıyor,
   * yani yeniden çekilen listede o kelebek olmazdı ve onay ekranındaki
   * "Follow it in the meadow" boşa düşerdi. Buraya eklenince sahne kimliği
   * görüyor ve kontenjan doluysa sabit bir yerleşiğe eşliyor
   * (`visitors.js` → `DECOY_INDEX`).
   */
  const [meadowList, setMeadowList] = useState<MeadowEntry[]>(initialMeadow);

  /*
   * Hesabın kendi sayıları ve profil kilidi — SUNUCUDAN.
   *
   * ⚠ Kilit istemcide TUTULMUYOR, yalnızca gösteriliyor. Eskiden kilit sadece
   * bu bileşenin durumundaydı ve yenilemek onu sıfırlıyordu; ayarlardaki
   * "cannot be changed again for 1 day" notu tutulmayan bir sözdü.
   */
  const [account, setAccount] = useState<AccountFacts | null>(initialAccount);

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
     * Liste olduğu gibi geçiyor: iki ömür ucu da sunucudan geliyor ve sahne
     * aradaki oranı çiziyor. Ömrün kaç gün olduğu burada da, sahnede de
     * bilinmiyor — kural `lib/types.ts`te ve onu yalnızca sunucu okuyor.
     */
    meadow.sync(meadowList);
  }, [meadow, meadowList]);

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

    /*
     * ⚠ Doğrulama ekranı da bir DENEMENİN cevabı ve onunla birlikte gitmeli.
     *
     * `awaitingVerify` yalnızca `signOut`ta sıfırlanıyordu; kart terk
     * edildiğinde kalıyor ve `signin` görünümü bir daha AÇILMIYORDU — kayıt
     * olan biri "check your inbox"tan çıkıp giriş yapmak istediğinde aynı
     * ekranla karşılaşıyordu, çünkü `SignInCard`ın `status`u bu bayraktan
     * okunuyor. Giriş formuna dönmenin tek yolu sekmeyi yenilemekti.
     *
     * Burada durması güvenli: `clearAttempts` YALNIZCA gezinmede çağrılıyor
     * (`go`/`back`/`reset`), yani kayıt başarılı olduğunda ekran yerinde
     * kalıyor ve ancak kullanıcı başka bir yere gidince düşüyor.
     */
    setAwaitingVerify(false);
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

  /*
   * ⚠ RENK, TOHUM ve KİMLİK artık SUNUCUDAN geliyor.
   *
   * Renk istemcide çekildiği sürece kullanıcı yeniden deneyerek istediği
   * rengi tutturabiliyordu; kartın sözü ise "The meadow picks the wings".
   * Tohum da sunucudan, çünkü kelebek yenilemeden sonra da aynı boyda ve
   * çayırın aynı kenarından girmek zorunda.
   */
  async function releaseAsGuest() {
    // Yeni deneme, temiz sayfa: önceki red ekranda kalmamalı
    setReleaseFailure(null);

    const forced = takeForcedFailure<ReleaseFailure>();
    if (forced) {
      setReleaseFailure(forced);
      return;
    }

    setPending(true);
    const result = await releaseGuestAction();
    setPending(false);

    if (!result.ok) {
      setReleaseFailure(result.error);
      /*
       * Günlük hak reddi butonu da kilitliyor: kural ihlali, arıza değil.
       * (`network` kilitlemiyor — bkz. ReleaseNotice.)
       */
      if (result.error.kind === 'guest-limit') setGuestBlocked(true);
      return;
    }

    setMeadowList((list) => [...list, toMeadowEntry(result.butterfly, 'guest')]);
    setLastReleased(result.butterfly);
    setTotal(result.total);
    setGuestBlocked(true);
    reset('released');
  }

  async function releaseAsMember(name: string, fore: string, hind: string) {
    setReleaseFailure(null);

    const forced = takeForcedFailure<ReleaseFailure>();
    if (forced) {
      setReleaseFailure(forced);
      return;
    }

    setPending(true);
    const result = await releaseMemberAction(name, fore, hind);
    setPending(false);

    if (!result.ok) {
      setReleaseFailure(result.error);
      return;
    }

    setButterflies((list) => [...list, result.butterfly]);
    setMeadowList((list) => [...list, toMeadowEntry(result.butterfly, 'member')]);
    setLastReleased(result.butterfly);
    setTotal(result.total);

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
    /*
     * Kişisel listeler girişin cevabından geliyor. Sayfa açılırken de
     * okunuyorlar ama o an kullanıcı misafirdi, yani boştular.
     */
    setButterflies(result.butterflies);
    setFinished(result.history);
    setAccount(result.account);
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
   * ── Şifre sıfırlama ─────────────────────────────────────────────────────
   *
   * ⚠ Cevaba BAKILMIYOR ve bakılmamalı: `requestPasswordReset` her zaman
   * başarı döndürüyor, çünkü kayıtlı adresle kayıtlı olmayanı ayırt eden bir
   * cevap bu formu kullanıcı sayma aracına çevirirdi. Kart "gönderildi"
   * ekranını kendi gösteriyor.
   */
  async function askPasswordReset(email: string) {
    setPending(true);
    await requestPasswordReset(email);
    setPending(false);
  }

  async function submitNewPassword(password: string) {
    setPending(true);
    const result = await resetPassword(password);
    setPending(false);

    if (!result.ok) {
      /*
       * Ölü bağlantıya tıklayan buraya HİÇ gelmiyor (sessizce çayıra düşüyor,
       * bkz. `/auth/confirm`). Buraya gelip de bunu görmek, formu doldururken
       * bağlantının süresinin dolması demek.
       *
       * `password` reddi arayüzden ulaşılamıyor — buton zaten kilitli.
       */
      if (result.reason === 'link') setResetExpired(true);
      return;
    }

    /*
     * Şifre değişti ve sunucu oturumu kurdu. Profil ve listeler için sayfa
     * yeniden yükleniyor: tek sayfa mimarisinde bunu yapmanın alternatifi,
     * `resetPassword`ın da profili ve iki listeyi döndürmesiydi — `signIn`
     * gibi. Sıfırlama nadir bir olay, tam bir yükleme burada kabul edilebilir
     * ve akışı basit tutuyor.
     */
    window.location.href = '/';
  }

  /*
   * ⚠ ÇAYIR BOŞALMIYOR. Salınan kelebek çayırın, salanın değil — oturum
   * kapansa da yedi gününü doldurmaya devam ediyor. Burada temizlenen tek
   * şey KİŞİSEL olan: profil ve "Kelebeklerim" listesi.
   *
   * (Sunucusuz sürümde bu fonksiyon `meadowList`i de boşaltıyordu ve bu
   * yanlıştı; kelebekleri tutan başka kimse olmadığı için mecburdu.)
   */
  async function signOut() {
    setProfile(null);
    setButterflies([]);
    setFinished([]);
    setAccount(null);
    setAwaitingVerify(false);
    reset('landing');
    await signOutAction();
  }

  /*
   * Hesabı siler. KALICI ve geri alma penceresi yok.
   *
   * ⚠ ÇAYIR DA TEMİZLENİYOR — çıkıştan (`signOut`) ayrıldığı tek nokta bu.
   * Orada kelebekler çayırın malı ve uçmaya devam ediyor; burada satırları
   * silindi, yani başkalarının ekranında da yoklar. Uyarı metninin sözü
   * ("your butterflies leave the meadow at once") tam olarak bu.
   *
   * Sunucu neyi sildiğini biliyor ama İSTEMCİ bilmiyor: `meadowList` isimsiz
   * ve sahipsiz (bkz. yukarısı). Hangi satırların gideceğini ancak
   * kullanıcının kendi listesindeki kimliklerden çıkarabiliyoruz.
   *
   * ⚠ Ekran sunucu CEVAP VERDİKTEN SONRA temizleniyor. Önce temizlenseydi,
   * düşen bir istekten sonra kullanıcı silinmiş sanır ve yenileyince hesabını
   * yerinde bulurdu.
   */
  async function deleteAccount() {
    // İki kez basılan düğme iki silme isteği demek; ikincisi zaten oturumsuz.
    if (pending) return;
    setPending(true);
    const result = await deleteAccountAction();
    setPending(false);
    if (!result.ok) return;

    const mine = new Set(butterflies.map((b) => b.id));
    setMeadowList((list) => list.filter((e) => !mine.has(e.id)));

    setProfile(null);
    setButterflies([]);
    setFinished([]);
    setAccount(null);
    stopWatching();
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
   * ── Ömrün dolması (Aşama F) ─────────────────────────────────────────────
   *
   * Sunucu ömrü dolanı zaten GÖRMÜYOR: bütün sorgular `expires_at > now()`
   * diyor, yani yenilenen bir sayfada o kelebek hiç gelmiyor. Eksik olan,
   * sayfayı AÇIK BIRAKAN kullanıcıydı — kelebek sahnede solup görünmez
   * oluyordu ama listede duruyor, yuvayı tutuyor ve geçmişe hiç düşmüyordu.
   *
   * ⚠ Burada bir SÜRE HESAPLANMIYOR. Karşılaştırılan şey sunucudan gelen
   * mutlak an (`expiresAt`); "yedi gün" bilgisi tek bir yerde duruyor
   * (`lib/types.ts`) ve buraya ikinci bir kopyası girmiyor.
   *
   * Otuz saniyelik tur yeterli: sahne kelebeği tam anında yok ediyor
   * (`visitors.js` iki mutlak anı alıp arasını çiziyor), buradaki iş yalnızca
   * listeleri ve yuva sayacını gerçeğe döndürmek. Arka plandaki sekmede
   * tarayıcı turu seyreltiyor ve bunun bir zararı yok — kullanıcı geri
   * döndüğünde ilk tur farkı kapatıyor.
   */
  useEffect(() => {
    function tick() {
      const now = Date.now();

      const goneMine = butterflies.filter(
        (b) => expiresAt(b).getTime() <= now,
      );
      const goneMeadow = meadowList.some((e) => e.expiresAt.getTime() <= now);

      if (goneMine.length === 0 && !goneMeadow) return;

      /*
       * Çayır listesi HERKESİN kelebeğini taşıyor: düşenler yalnızca
       * kullanıcının kendi kelebekleri değil. Köprü farkı kendisi hesaplıyor
       * ve boşalan yuvayı havuza döndürüyor (`visitors.remove`).
       */
      if (goneMeadow) {
        setMeadowList((list) =>
          list.filter((e) => e.expiresAt.getTime() > now),
        );
      }

      if (goneMine.length === 0) return;

      setButterflies((list) =>
        list.filter((b) => expiresAt(b).getTime() > now),
      );

      /*
       * Geçmiş satırı YALNIZCA isim ve tarih taşıyor; renk ömürle birlikte
       * gidiyor (gizlilik metninin sözü ve `readOwnHistory`'nin de yaptığı).
       * Sunucuda rengi gerçekten silen şey günlük süpürme
       * (`app/api/cron/sweep`).
       *
       * Yeni düşen en öne: liste salma tarihine göre yeniye doğru sıralı ve
       * yedi gününü şimdi dolduran, listedeki en son salınan kelebek.
       */
      setFinished((f) => [
        ...goneMine.map((b) => ({ ...b, foreHex: '', hindHex: '' })),
        ...f,
      ]);

      // İzlenen kelebek gittiyse kamera boşluğa bakıyor demek.
      if (watched && goneMine.some((b) => b.id === watched)) stopWatching();

      /*
       * ⚠ Veda ekranı YALNIZCA çayır ekranındayken açılıyor.
       *
       * Bir formun ortasındaki kullanıcıyı başka bir ekrana taşımak, yazdığı
       * şeyi elinden almak olurdu; ömrün dolması onun BAŞLATTIĞI bir olay da
       * değil. Başka bir ekrandaysa listeler sessizce güncelleniyor ve veda,
       * hiç görünmeden geçiyor — kelebeğin gidişi zaten geçmişte yazılı.
       */
      if (view === 'meadow') {
        setExpired(goneMine[goneMine.length - 1]);
        reset('farewell');
      }
    }

    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [butterflies, meadowList, view, watched]);

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
              onForgot={() => go('forgot')}
            />
          )}

          {view === 'forgot' && (
            <ForgotCard
              pending={pending}
              onSend={askPasswordReset}
              onBack={back}
            />
          )}

          {view === 'reset' && (
            <ResetCard
              pending={pending}
              expired={resetExpired}
              onSubmit={submitNewPassword}
              onBack={() => reset(signedIn ? 'meadow' : 'landing')}
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
              /*
               * ⚠ İki sayı da SUNUCUDAN ve ikisi de KİŞİSEL. "Released in
               * total" eskiden küresel sayaca kullanıcının uçan kelebek
               * sayısını ekliyordu — kimsenin sormadığı bir toplam; üyelik
               * tarihi ise elle yazılmış sabit bir gündü.
               */
              releasedTotal={account?.releasedTotal ?? butterflies.length}
              memberSince={account?.memberSince ?? new Date()}
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
              lockedUntil={account?.lockedUntil ?? null}
              /*
               * Kilit SUNUCUDA uygulanıyor ve cevabı buradan geri geliyor.
               * Reddedilirse (başka bir sekmede kaydedilmiş) ekran gerçek
               * kilit anını alıyor ve kendini düzeltiyor — yeni bir hata dili
               * icat edilmiyor, kartın zaten çizili olan kilitli hâli
               * yetiyor.
               */
              onSave={async (name, avatarHex) => {
                const result = await updateProfile(name, avatarHex);

                if (!result.ok) {
                  if (result.reason === 'locked' && account) {
                    setAccount({ ...account, lockedUntil: result.lockedUntil });
                  }
                  return;
                }

                setProfile(result.profile);
                if (account) {
                  setAccount({ ...account, lockedUntil: result.lockedUntil });
                }
              }}
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

/**
 * Yeni salınan kelebeği çayır listesinin diline çevirir.
 *
 * Ömrün bitiş anı burada EKLENİYOR, çünkü salma cevabı yalnızca başlangıcı
 * taşıyor. `expiresAt` (lib/types.ts) `LIFESPAN_DAYS`i okuyan tek yer — sunucu
 * da aynı kuralı aynı dosyadan okuyor, yani iki taraf ayrışamaz.
 */
function toMeadowEntry(b: Butterfly, kind: 'guest' | 'member'): MeadowEntry {
  return {
    id: b.id,
    foreHex: b.foreHex,
    hindHex: b.hindHex,
    seed: b.seed ?? 0,
    releasedAt: b.releasedAt,
    expiresAt: expiresAt(b),
    kind,
  };
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
