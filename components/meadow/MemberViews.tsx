'use client';

import { Butterfly } from '@/components/Butterfly';
import { Button } from '@/components/ui/Button';
import { SLOT_LIMIT, type Profile } from '@/lib/types';

/*
 * Kartsız çayır ekranları — 06 (girişli karşılama) ve 12 (ömür bitti).
 *
 * İkisinde de kart yok, bilinçli: bunlar bir form adımı değil, bir durum
 * bildirimi. Metin doğrudan çayırın üstünde duruyor.
 */

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five'] as const;

/** Ekran 06 — girişli kullanıcı çayıra bakıyor. */
export function MemberMeadow({
  flyingNow,
  onRelease,
  onMyButterflies,
}: {
  flyingNow: number;
  onRelease: () => void;
  onMyButterflies: () => void;
}) {
  const word = WORDS[Math.min(flyingNow, WORDS.length - 1)];
  const full = flyingNow >= SLOT_LIMIT;

  return (
    <div className="flex max-w-[560px] flex-col gap-6 lg:gap-7">
      <p className="eyebrow">welcome</p>

      <h2 className="font-display text-[40px] font-light leading-[1.02] tracking-[-0.01em] text-ink lg:text-[58px]">
        {flyingNow === 0 ? (
          <>The meadow is waiting.</>
        ) : (
          <>
            {word} of yours
            <br />
            {flyingNow === 1 ? 'is' : 'are'} out there.
          </>
        )}
      </h2>

      <p className="max-w-[34ch] font-display text-[19px] leading-[1.45] text-body lg:text-[21px]">
        {full
          ? 'Every slot is taken. One opens when the oldest finishes its seven days.'
          : 'Let another one go, or just watch for a while.'}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Button disabled={full} onClick={onRelease}>
          Release a butterfly
        </Button>
        <Button variant="secondary" onClick={onMyButterflies}>
          My butterflies · {flyingNow}/{SLOT_LIMIT}
        </Button>
      </div>
    </div>
  );
}

/** Ekran 12 — bir kelebeğin yedi günü doldu. */
export function FarewellView({
  name,
  releasedAt,
  onRelease,
  onMyButterflies,
}: {
  name: string | null;
  releasedAt: Date;
  onRelease: () => void;
  onMyButterflies: () => void;
}) {
  const ended = new Date(releasedAt.getTime() + 7 * 86400000);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

  return (
    <div className="flex max-w-[560px] flex-col gap-6 lg:gap-7">
      <p className="eyebrow">
        {fmt(releasedAt)} - {fmt(ended)}
      </p>

      <h2 className="max-w-[22ch] font-display text-[38px] font-light leading-[1.04] tracking-[-0.01em] text-ink lg:text-[56px]">
        {name ? name + "'s seven days are over." : 'Its seven days are over.'}
      </h2>

      <p className="max-w-[34ch] font-display text-[19px] leading-[1.45] text-body lg:text-[21px]">
        Its wings went back to the meadow. A slot is free again.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Button size="md" onClick={onRelease}>
          Release another
        </Button>
        <Button size="md" variant="secondary" onClick={onMyButterflies}>
          My butterflies
        </Button>
      </div>
    </div>
  );
}

/*
 * Hesap rozeti — sağ üstte, sayacın üstünde.
 *
 * İçinde YALNIZCA avatar var, isim yok (handoff bunu özellikle belirtiyor).
 *
 * İki şey düzeltildi:
 *
 * 1. TAM DAİRE. Önceden `p-2` ile 30x24'lük bir kelebeğin etrafına eşit
 *    dolgu veriliyordu; sonuç 46x40, yani yumurta. Boyut artık sabit ve
 *    kare, kelebek ortada.
 * 2. OPAK. Zemin `rgba(...,0.82)` idi ve arkadaki çayır avatarın içinden
 *    sızıyordu — profil rengi olduğundan soluk görünüyordu. Krem artık tam.
 */
const CHIP = 48;

export function AccountChip({
  profile,
  onClick,
}: {
  profile: Profile;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="my account"
      className="flex shrink-0 items-center justify-center rounded-full shadow-chip transition-transform hover:scale-105"
      style={{
        width: CHIP,
        height: CHIP,
        backgroundColor: '#FDF6F2',
        border: '1px solid rgba(44,34,32,0.08)',
      }}
    >
      <Butterfly fore={profile.avatarHex} width={28} height={23} simple />
    </button>
  );
}
