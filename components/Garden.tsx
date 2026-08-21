'use client';

import { useEffect, useState } from 'react';
import { Meadow, useMeadowBridge } from '@/components/meadow/Meadow';
import { MeadowShell, ReleaseCounter } from '@/components/meadow/MeadowShell';
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
import {
  GUEST_DAILY_LIMIT,
  SLOT_LIMIT,
  WING_COLOURS,
  type Butterfly,
  type Profile,
} from '@/lib/types';

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

/** Sunucu gelene kadar hesap ekranlarını dolduran örnek kelebekler. */
function seedButterflies(): Butterfly[] {
  const day = 86_400_000;
  const now = Date.now();
  return [
    {
      id: 'seed-mint',
      name: 'Mint',
      foreHex: WING_COLOURS[0].hex,
      hindHex: WING_COLOURS[1].hex,
      releasedAt: new Date(now - day),
    },
    {
      id: 'seed-olive',
      name: 'Olive',
      foreHex: WING_COLOURS[4].hex,
      hindHex: WING_COLOURS[2].hex,
      releasedAt: new Date(now - 5 * day),
    },
    {
      id: 'seed-juno',
      name: 'Juno',
      foreHex: WING_COLOURS[3].hex,
      hindHex: WING_COLOURS[3].hex,
      releasedAt: new Date(now - 3 * day),
    },
  ];
}

export function Garden({ initialTotal = 0 }: { initialTotal?: number }) {
  const [view, setView] = useState<View>('landing');

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

  const [profile, setProfile] = useState<Profile | null>(null);
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
   */
  const [watching, setWatching] = useState(false);

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
    meadow.sync([...butterflies, ...guestButterflies]);
  }, [meadow, butterflies, guestButterflies]);

  /** Yeni ekrana gec ve gecmise ekle. */
  function go(next: View) {
    setHistory((h) => [...h, view]);
    setView(next);
  }

  /** Bir onceki ekrana don. Gecmis bossa koke. */
  function back() {
    setHistory((h) => {
      const prev = h[h.length - 1];
      setView(prev ?? (signedIn ? 'meadow' : 'landing'));
      return h.slice(0, -1);
    });
  }

  /** Akis bitti: gecmisi temizleyip yeni bir kok ekrana gec. */
  function reset(next: View) {
    setHistory([]);
    setView(next);
  }

  async function fakeDelay() {
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, 420));
    setPending(false);
  }

  async function releaseAsGuest() {
    await fakeDelay();

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
    await fakeDelay();
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
    reset('released');
  }

  function completeSignIn(email: string) {
    setProfile({ name: 'Wren', email, avatarHex: '#4F7FBF' });
    setButterflies(seedButterflies());
    reset(afterSignIn);
  }

  /*
   * ⚠ Çıkışta kelebekler çayırdan kalkıyor ve bu DOĞRU DEĞİL: salınan kelebek
   * çayırın, salanın değil — oturum kapansa da uçmaya devam etmeli. Sunucu
   * olmadığı için listeyi kimse tutmuyor, kelebekler yalnızca `butterflies`
   * içinde yaşıyor. Aşama C'de liste sunucudan geldiğinde bu satır kalkacak.
   */
  function signOut() {
    setProfile(null);
    setButterflies([]);
    reset('landing');
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

  const onMeadowView = view === 'landing' || view === 'meadow';

  return (
    <main className="meadow-stage">
      <Meadow bridge={meadow} />

      {watching && <StopWatchingButton onClick={() => setWatching(false)} />}

      <MeadowShell
        hidden={watching}
        scrim={view === 'settings' || view === 'farewell' ? 'heavy' : 'default'}
        counter={onMeadowView ? <ReleaseCounter total={total} /> : null}
        aside={
          onMeadowView ? (
            <WatchButton onClick={() => setWatching(true)} />
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
        <div key={view} className="view-fade">
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
              onDone={completeSignIn}
              onBack={back}
              onNeedsSetup={(email) => {
                setProfile({ name: '', email, avatarHex: '#4F7FBF' });
                go('setup');
              }}
            />
          )}

          {view === 'setup' && profile && (
            <SetupCard
              email={profile.email}
              onBack={back}
              onDone={(name, avatarHex) => {
                setProfile({ ...profile, name, avatarHex });
                setButterflies(seedButterflies());
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
              onRelease={releaseAsMember}
              onBack={back}
            />
          )}

          {view === 'released' && lastReleased && (
            <ReleasedView
              name={lastReleased.name}
              releasedAt={lastReleased.releasedAt}
              onMyButterflies={() => reset(signedIn ? 'butterflies' : 'signin')}
              onWatch={() => reset(signedIn ? 'meadow' : 'landing')}
            />
          )}

          {view === 'butterflies' && (
            <MyButterfliesCard
              butterflies={butterflies}
              onRelease={goRelease}
              onBack={back}
              onHistory={() => go('history')}
              onWatch={() => {
                // Kelebege kilitlenen kamera Asama D'nin isi; simdilik
                // izleme kipine gecerek sahneyi acik biraikiyor
                setWatching(true);
              }}
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
