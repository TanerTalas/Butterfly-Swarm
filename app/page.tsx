import { Meadow } from '@/components/meadow/Meadow';
import { MeadowShell, ReleaseCounter } from '@/components/meadow/MeadowShell';
import { Button } from '@/components/ui/Button';

/*
 * Tek sayfa.
 *
 * Yasal sayfalar dışında her şey burada yaşıyor: karşılama, salma akışı,
 * onay, hesap, ayarlar. Sayfa yenilenmesi ve tam ekran rota değişimi yok —
 * çayır hiç unmount olmuyor, kartlar çapraz geçişle değişiyor.
 *
 * Şu an yalnızca ekran 01 (karşılama) bağlı. Diğer ekranlar sırayla
 * gelecek; sahne ve kabuk ortak olduğu için her biri yalnızca kendi kartını
 * ekliyor.
 */
export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <Meadow />

      <MeadowShell counter={<ReleaseCounter total={0} />}>
        <div className="flex max-w-[470px] flex-col gap-6 lg:gap-7">
          <p className="eyebrow">the sakura meadow</p>

          <h1 className="font-display text-[52px] font-light leading-[0.98] tracking-[-0.02em] text-ink lg:text-[76px]">
            Butterfly Garden
          </h1>

          <p className="max-w-[32ch] font-display text-[19px] leading-[1.45] text-body lg:text-[22px]">
            Release a butterfly into the meadow. It flies for seven days, then
            it goes.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Button>Release a butterfly</Button>
            <Button variant="secondary">Sign in</Button>
          </div>

          <p className="eyebrow">wing colours and tracking need an account</p>
        </div>
      </MeadowShell>
    </main>
  );
}
