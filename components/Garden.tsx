'use client';

import { useState } from 'react';
import { Meadow } from '@/components/meadow/Meadow';
import { MeadowShell, ReleaseCounter } from '@/components/meadow/MeadowShell';
import { Button } from '@/components/ui/Button';
import { GuestReleaseCard } from '@/components/release/GuestReleaseCard';
import { ReleasedView } from '@/components/release/ReleasedView';

/*
 * Bahçe — tek sayfanın durum makinesi.
 *
 * Yasal sayfalar dışında hiçbir şey gerçek bir rota değil. Çayır HİÇ
 * unmount olmuyor; yalnızca üstündeki kart değişiyor ve geçişler çapraz
 * solmayla oluyor. Bu yüzden görünüm durumu burada, sahnenin dışında.
 *
 * ⚠ Salma işlemi şu an YEREL bir taklit. Gerçek kural sunucuda olacak
 * (Aşama C): 5 canlı kelebek sınırı, 7 gün ömür ve sayaç istemcide
 * hesaplanmıyor. Buradaki `release()` yalnızca akışı gezilebilir kılıyor.
 */

type View = 'landing' | 'guest-release' | 'released';

type Released = { name: string | null; at: Date };

export function Garden({ initialTotal = 0 }: { initialTotal?: number }) {
  const [view, setView] = useState<View>('landing');
  const [total, setTotal] = useState(initialTotal);
  const [released, setReleased] = useState<Released | null>(null);
  const [pending, setPending] = useState(false);

  async function releaseAsGuest() {
    setPending(true);
    // Sunucu çağrısının yerini tutuyor; gecikme akışın hissini korusun diye
    await new Promise((r) => setTimeout(r, 450));
    setReleased({ name: null, at: new Date() });
    setTotal((n) => n + 1);
    setPending(false);
    setView('released');
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <Meadow />

      <MeadowShell counter={<ReleaseCounter total={total} />}>
        {/*
         * Çapraz geçiş: görünüm anahtarı değişince eski kart solup yenisi
         * beliriyor. `key` üzerinden yeniden mount olduğu için giriş
         * animasyonu her seferinde çalışıyor.
         */}
        <div key={view} className="animate-[fade_320ms_ease]">
          {view === 'landing' && (
            <Landing
              onRelease={() => setView('guest-release')}
              onSignIn={() => setView('guest-release')}
            />
          )}

          {view === 'guest-release' && (
            <GuestReleaseCard
              pending={pending}
              onRelease={releaseAsGuest}
              onSignIn={() => setView('guest-release')}
            />
          )}

          {view === 'released' && released && (
            <ReleasedView
              name={released.name}
              releasedAt={released.at}
              onMyButterflies={() => setView('landing')}
              onWatch={() => setView('landing')}
            />
          )}
        </div>
      </MeadowShell>
    </main>
  );
}

function Landing({
  onRelease,
  onSignIn,
}: {
  onRelease: () => void;
  onSignIn: () => void;
}) {
  return (
    <div className="flex max-w-[470px] flex-col gap-6 lg:gap-7">
      <p className="eyebrow">the sakura meadow</p>

      <h1 className="font-display text-[52px] font-light leading-[0.98] tracking-[-0.02em] text-ink lg:text-[76px]">
        Butterfly Garden
      </h1>

      <p className="max-w-[32ch] font-display text-[19px] leading-[1.45] text-body lg:text-[22px]">
        Release a butterfly into the meadow. It flies for seven days, then it
        goes.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Button onClick={onRelease}>Release a butterfly</Button>
        <Button variant="secondary" onClick={onSignIn}>
          Sign in
        </Button>
      </div>

      <p className="eyebrow">wing colours and tracking need an account</p>
    </div>
  );
}
