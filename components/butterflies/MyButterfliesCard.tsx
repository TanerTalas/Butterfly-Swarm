'use client';

import { Butterfly } from '@/components/Butterfly';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Eye } from '@/components/ui/Icons';
import {
  LIFESPAN_DAYS,
  SLOT_LIMIT,
  daysLeft,
  formatReleased,
  type Butterfly as ButterflyRecord,
} from '@/lib/types';

/*
 * Kelebeklerim — ve beş yuva da dolu hâli.
 *
 * İkisi ayrı ekran değil, aynı kartın iki durumu: yuvalar dolduğunda birincil
 * buton "Max out" yazıp devre dışı kalıyor ve altına ne zaman yer açılacağını
 * söyleyen bir not düşüyor.
 *
 * Yeni tasarımda üç şey değişti:
 *
 *   - Her satırın sağında "Watch" düğmesi: kamerayı o kelebeğe kilitliyor.
 *     Liste artık yalnızca bir envanter değil, çayıra bir giriş noktası.
 *   - Boş yuvalar tek tek kutu olarak çizilmiyor; hepsi tek bir satırda
 *     "room for N more butterflies" diye özetleniyor. Beş kesik çizgili kutu
 *     kartı şişiriyor ve eksiklik gibi okunuyordu.
 *   - Altta "History": ömrünü tamamlamış kelebeklerin listesi.
 */
export function MyButterfliesCard({
  butterflies,
  onRelease,
  onWatch,
  onBack,
  onHistory,
}: {
  butterflies: ButterflyRecord[];
  onRelease: () => void;
  onWatch?: (b: ButterflyRecord) => void;
  onBack: () => void;
  onHistory: () => void;
}) {
  const used = butterflies.length;
  const full = used >= SLOT_LIMIT;
  const free = Math.max(0, SLOT_LIMIT - used);

  /*
   * SIRALAMA: en çok ömrü kalan üstte, en az kalan altta. Liste bir geri
   * sayım gibi okunuyor ve alttaki satır her zaman sıradaki veda.
   */
  const ordered = [...butterflies].sort(
    (a, b) =>
      daysLeft(b) - daysLeft(a) ||
      b.releasedAt.getTime() - a.releasedAt.getTime(),
  );

  return (
    <Card width={500}>
      <BackLink label="back to the meadow" onClick={onBack} />

      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[26px] leading-tight text-ink lg:text-[30px]">
          My butterflies
        </h2>
        <span
          className={`font-mono text-[12px] tracking-[0.14em] ${full ? 'text-accent' : 'text-label'}`}
        >
          {used}/{SLOT_LIMIT}
        </span>
      </div>

      {/*
       * Liste kartın İÇİNDE kayıyor, kartın kendisi değil: beş satır kısa bir
       * pencerede kartı kabından taşırıyor ve yuvarlak köşeleri kırpıyordu.
       * Çubuk gizlenmiyor, burada kaydırılabilirlik fark edilmeli.
       *
       * Tavan yeni tasarımla birlikte düştü: üstteki geri bağlantısı ve
       * alttaki History satırı karta ~50px ekledi ve eski tavanla kart yine
       * taşıyordu.
       */}
      <ul className="scrollbar-slim -mr-2 flex max-h-[min(38vh,300px)] flex-col overflow-y-auto pr-2">
        {ordered.map((b, i) => (
          <li
            key={b.id}
            className={`flex items-center gap-3 py-4 ${i > 0 ? 'border-t border-[rgba(44,34,32,0.08)]' : ''}`}
          >
            <Butterfly
              fore={b.foreHex}
              hind={b.hindHex}
              width={33}
              height={27}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[21px] leading-none text-ink">
                {b.name ?? 'Unnamed'}
              </p>
              <p className="mt-1.5 font-mono text-[11px] tracking-[0.14em] text-faint">
                released {formatReleased(b.releasedAt)}
              </p>
            </div>

            <div className="w-[84px] shrink-0">
              {/*
               * Harf aralığı YOK, bilerek. Diğer monospace etiketlerde 0.14em
               * var ama burada 84px'lik sütuna "6 days left" sığmıyor ve iki
               * satıra kırılıyor. Tasarımda da bu satır aralıksız.
               */}
              <p className="mb-2 text-right font-mono text-[12px] whitespace-nowrap text-body">
                {daysLeft(b)} days left
              </p>
              <div className="h-1 w-full rounded-full bg-[rgba(44,34,32,0.1)]">
                <div
                  className="h-1 rounded-full bg-accent"
                  style={{ width: `${(daysLeft(b) / LIFESPAN_DAYS) * 100}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => onWatch?.(b)}
              className="flex h-[34px] shrink-0 items-center gap-[7px] rounded-full border border-[rgba(44,34,32,0.2)] px-3.5 font-mono text-[12px] whitespace-nowrap text-body transition-colors hover:border-[rgba(44,34,32,0.34)] hover:bg-panel"
            >
              <Eye size={14} />
              Watch
            </button>
          </li>
        ))}

        {/*
         * Boş yuvalar TEK satırda özetleniyor. Beş ayrı kesik çizgili kutu
         * kartı şişiriyor ve bir eksiklik listesi gibi okunuyordu; tek satır
         * aynı bilgiyi bir davet olarak veriyor.
         */}
        {free > 0 && (
          <li className={ordered.length > 0 ? 'pt-4' : ''}>
            <div className="flex h-11 items-center justify-center rounded-[12px] border border-dashed border-[rgba(44,34,32,0.2)]">
              <span className="font-mono text-[11px] tracking-[0.14em] text-faint">
                room for {free} more {free === 1 ? 'butterfly' : 'butterflies'}
              </span>
            </div>
          </li>
        )}
      </ul>

      <div className="flex flex-col gap-2">
        <Button size="md" fullWidth disabled={full} onClick={onRelease}>
          {full ? 'Max out' : 'Release another'}
        </Button>

        {full && (
          <p className="text-center font-mono text-[11px] leading-[1.6] tracking-[0.14em] text-faint">
            a slot opens once one of them finishes its time
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onHistory}
        className="text-center font-mono text-[12px] tracking-[0.14em] text-accent transition-opacity hover:opacity-70"
      >
        History
      </button>
    </Card>
  );
}
