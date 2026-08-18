'use client';

import { Butterfly } from '@/components/Butterfly';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

/*
 * Ekran 02 — misafir salma.
 *
 * Misafir kanat rengi SEÇEMİYOR; renk sunucuda paletten rastgele çekiliyor.
 * Kart bunu bir kısıtlama gibi değil, bir bilgi gibi anlatıyor: kilitli
 * panel gri bir kelebek gösteriyor ve altında `locked` yazıyor.
 *
 * "Sign in to choose the wing colours" prototipte düz metindi; handoff'un
 * 2 numaralı değişikliği onu BUTONA çeviriyor — girişe götürüyor ve
 * girişten sonra kullanıcıyı buraya, renk seçici açık halde geri getiriyor.
 */
export function GuestReleaseCard({
  onRelease,
  onSignIn,
  pending,
}: {
  onRelease: () => void;
  onSignIn: () => void;
  pending?: boolean;
}) {
  return (
    <Card>
      <p className="eyebrow text-accent">guest</p>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-[28px] leading-tight text-ink lg:text-[34px]">
          A butterfly at random
        </h2>
        <p className="text-[14px] leading-[1.6] text-body-soft">
          We pick the wings for you. It joins the meadow straight away and
          flies for seven days.
        </p>
      </div>

      {/* Kilitli renk paneli */}
      <div className="flex items-center gap-5 rounded-[14px] bg-panel p-5">
        <Butterfly fore="#C9B8B1" hind="#B9A69E" width={92} height={74} />
        <div className="flex flex-col gap-2">
          <p className="eyebrow">forewing · hindwing</p>
          <p className="meta tracking-[0.18em] uppercase">locked</p>
        </div>
      </div>

      <Button size="md" fullWidth onClick={onRelease} disabled={pending}>
        {pending ? 'Letting it go…' : 'Let it go'}
      </Button>

      <button
        type="button"
        onClick={onSignIn}
        className="meta text-center text-accent underline-offset-4 transition-colors hover:underline"
      >
        sign in to choose the wing colours
      </button>
    </Card>
  );
}
