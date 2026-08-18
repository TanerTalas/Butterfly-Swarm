'use client';

import { Butterfly } from '@/components/Butterfly';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  LIFESPAN_DAYS,
  SLOT_LIMIT,
  daysLeft,
  formatReleased,
  type Butterfly as ButterflyRecord,
} from '@/lib/types';

/*
 * Ekran 08 — kelebeklerim (ve 11 — beş yuva da dolu).
 *
 * İkisi ayrı ekran değil, aynı kartın iki durumu: yuvalar dolduğunda sayaç
 * vurgu rengine geçiyor, birincil buton devre dışı kalıyor ve altına ne zaman
 * yer açılacağını söyleyen bir not düşüyor.
 *
 * Boş yuvalar da çiziliyor. Handoff'un kesik çizgili kutuları bir eksiklik
 * göstergesi değil, bir davet: kaç kelebek daha bırakabileceğin görünüyor.
 */
export function MyButterfliesCard({
  butterflies,
  onRelease,
  onSelect,
}: {
  butterflies: ButterflyRecord[];
  onRelease: () => void;
  onSelect?: (b: ButterflyRecord) => void;
}) {
  const used = butterflies.length;
  const full = used >= SLOT_LIMIT;
  const empty = Math.max(0, SLOT_LIMIT - used);

  // Sıradaki yuvayı açacak kelebek: ömrü en yakında bitecek olan
  const next = [...butterflies].sort(
    (a, b) => daysLeft(a) - daysLeft(b),
  )[0];

  return (
    <Card width={500}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[26px] leading-tight text-ink lg:text-[30px]">
          My butterflies
        </h2>
        <span
          className={`font-mono text-[12px] tracking-[0.14em] ${full ? 'text-accent' : 'text-faint'}`}
        >
          {used}/{SLOT_LIMIT}
        </span>
      </div>

      <ul className="flex flex-col">
        {butterflies.map((b, i) => (
          <li
            key={b.id}
            className={`flex items-center gap-4 py-4 ${i > 0 ? 'border-t border-[rgba(44,34,32,0.08)]' : ''}`}
          >
            <Butterfly fore={b.foreHex} hind={b.hindHex} width={33} height={27} />

            <button
              type="button"
              onClick={() => onSelect?.(b)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate font-display text-[21px] text-ink">
                {b.name ?? 'Unnamed'}
              </p>
              <p className="font-mono text-[11px] tracking-[0.14em] text-faint">
                released {formatReleased(b.releasedAt)}
              </p>
            </button>

            <div className="w-[104px] shrink-0">
              <p className="mb-2 text-right font-mono text-[12px] tracking-[0.14em] text-body-soft">
                {daysLeft(b)} days left
              </p>
              <div className="h-1 w-full rounded-full bg-[rgba(44,34,32,0.1)]">
                <div
                  className="h-1 rounded-full bg-accent"
                  style={{
                    width: `${(daysLeft(b) / LIFESPAN_DAYS) * 100}%`,
                  }}
                />
              </div>
            </div>
          </li>
        ))}

        {Array.from({ length: empty }).map((_, i) => (
          <li
            key={`empty-${i}`}
            className={butterflies.length + i > 0 ? 'pt-4' : ''}
          >
            <div className="flex h-[54px] items-center justify-center rounded-[12px] border border-dashed border-[rgba(44,34,32,0.2)]">
              <span className="font-mono text-[11px] tracking-[0.14em] text-faint">
                empty slot
              </span>
            </div>
          </li>
        ))}
      </ul>

      <Button size="md" fullWidth disabled={full} onClick={onRelease}>
        Release another
      </Button>

      {full && next && (
        <p className="text-center font-mono text-[11px] leading-[1.6] tracking-[0.14em] text-faint">
          a slot opens in {daysLeft(next)} days, when{' '}
          {next.name ?? 'the oldest'}&apos;s seven days end
        </p>
      )}
    </Card>
  );
}
