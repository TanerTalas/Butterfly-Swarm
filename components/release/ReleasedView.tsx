'use client';

import { Button } from '@/components/ui/Button';

/*
 * Ekran 03 — salındı onayı.
 *
 * Kart YOK, bilinçli: salma anı bir form adımı değil, bir duraklama.
 * Metin doğrudan çayırın üstünde duruyor ve sağ üstteki sayaç artmış oluyor.
 *
 * ⚠ Handoff'ta bir çelişki var. Bu ekran misafir akışının altında listeli ve
 * örnek metni "Mint is flying." — ama misafir kelebeklerinin İSMİ YOK
 * ("Guests can release an unnamed butterfly"). Burada isim varsa isim,
 * yoksa isimsiz cümle kuruluyor. Karar sahibinin onayını bekliyor.
 */
export function ReleasedView({
  name,
  releasedAt,
  onMyButterflies,
  onWatch,
}: {
  name: string | null;
  releasedAt: Date;
  onMyButterflies: () => void;
  onWatch: () => void;
}) {
  const stamp = releasedAt
    .toLocaleString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .toLowerCase();

  return (
    <div className="flex max-w-[560px] flex-col gap-7">
      <p className="eyebrow">{stamp}</p>

      <h2 className="font-display text-[40px] font-light leading-[1.02] tracking-[-0.01em] text-ink lg:text-[62px]">
        {name ? `${name} is flying.` : 'Your butterfly is flying.'}
      </h2>

      <p className="max-w-[34ch] font-display text-[19px] leading-[1.45] text-body lg:text-[21px]">
        Seven days from now. Look for it in the meadow.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Button size="md" onClick={onWatch}>
          Follow {name ?? 'it'} in the meadow
        </Button>
        <Button size="md" variant="secondary" onClick={onMyButterflies}>
          My butterflies
        </Button>
      </div>
    </div>
  );
}
