'use client';

import { useState } from 'react';
import { BackLink } from '@/components/ui/BackLink';
import { Card } from '@/components/ui/Card';
import { ArrowLeft } from '@/components/ui/Icons';
import { formatReleased, type Butterfly } from '@/lib/types';

/*
 * Geçmiş — ömrünü tamamlamış kelebekler.
 *
 * Yeni tasarımla gelen ekran. Satırlar sade: yalnızca isim ve tarih. Kanat
 * rengi, kalan gün, ilerleme çubuğu yok — hepsi artık geçersiz. Bu bir
 * envanter değil, bir kayıt defteri.
 *
 * ⚠ Bu ekran gizlilik metniyle çelişebilir. Orada "yedi günü dolan kelebek
 * kaydı siliniyor" yazıyor; bir geçmiş listesi tutmak o kaydı saklamak
 * demek. Aşama C'de ya metin ya da saklama süresi düzeltilmeli — silinen
 * kaydın geçmişte görünmesi mümkün değil.
 */

const PAGE_SIZE = 5;

export function HistoryCard({
  butterflies,
  onBack,
}: {
  butterflies: Butterfly[];
  onBack: () => void;
}) {
  const [page, setPage] = useState(0);

  // En yeni önce: geçmiş, zamanda geriye doğru okunuyor
  const ordered = [...butterflies].sort(
    (a, b) => b.releasedAt.getTime() - a.releasedAt.getTime(),
  );

  const pageCount = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = ordered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <Card width={500}>
      <BackLink label="my butterflies" onClick={onBack} />

      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[26px] leading-tight text-ink lg:text-[30px]">
          History
        </h2>
        <span className="font-mono text-[12px] tracking-[0.14em] text-label">
          {ordered.length} total
        </span>
      </div>

      {ordered.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-[12px] border border-dashed border-[rgba(44,34,32,0.2)]">
          <span className="font-mono text-[11px] tracking-[0.14em] text-faint">
            nothing has finished its seven days yet
          </span>
        </div>
      ) : (
        <>
          <ul className="flex flex-col">
            {rows.map((b) => (
              <li
                key={b.id}
                className="flex items-baseline justify-between gap-4 border-b border-[rgba(44,34,32,0.08)] py-[13px]"
              >
                <span className="truncate font-display text-[19px] text-ink">
                  {b.name ?? 'Unnamed'}
                </span>
                <span className="shrink-0 font-mono text-[11px] tracking-[0.14em] text-faint">
                  {formatReleased(b.releasedAt)}
                </span>
              </li>
            ))}
          </ul>

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-5">
              <PageButton
                label="previous page"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              />
              <span className="font-mono text-[12px] tracking-[0.14em] text-label">
                {current + 1} of {pageCount}
              </span>
              <PageButton
                label="next page"
                flip
                disabled={current >= pageCount - 1}
                onClick={() => setPage(current + 1)}
              />
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function PageButton({
  label,
  onClick,
  disabled,
  flip,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  flip?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[rgba(44,34,32,0.2)] text-ink transition-colors hover:bg-panel disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
    >
      <span className={flip ? 'rotate-180' : undefined}>
        <ArrowLeft size={14} />
      </span>
    </button>
  );
}
