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
 * ── Ne SAKLANIYOR ─────────────────────────────────────────────────────────
 *
 * Satırın sadeliği bir tasarım tercihi değil, saklama kuralının kendisi:
 * yedi gün dolunca kelebeğin rengi ve çayırdaki yeri GİDİYOR, geriye isim ve
 * tarih kalıyor. Gizlilik metni ("How long", `lib/legal.ts`) tam olarak bunu
 * söylüyor.
 *
 * ⚠ Bu satıra bir alan eklemek gizlilik metnini de değiştirmek demek.
 * Eskiden metin kaydın SİLİNDİĞİNİ söylüyordu ve bu ekran onu yalanlıyordu.
 *
 * ── D2: geçmiş boş ────────────────────────────────────────────────────────
 *
 * Boş kutu "burada bir şey yok" diyordu; söylemesi gereken "buraya
 * birikecek". Fark zaman kipinde: geçmiş bugün boş olduğu için değil, henüz
 * hiçbir kelebek yedi gününü doldurmadığı için boş — ve bu geçici.
 *
 * Aynı kutuda iki satır: ne olmadığı, ve buranın ne olduğu.
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
  const rows = ordered.slice(
    current * PAGE_SIZE,
    current * PAGE_SIZE + PAGE_SIZE,
  );

  return (
    <Card width={500}>
      <BackLink label="my butterflies" onClick={onBack} />

      <div className="card-head">
        <h2 className="card-title">History</h2>
        <span className="tally">{ordered.length} total</span>
      </div>

      {ordered.length === 0 ? (
        <div className="empty-slot empty-slot--block empty-state">
          <p className="empty-state-title">Nothing has finished yet</p>
          <p className="note note--center">
            every butterfly lands here after its seven days
          </p>
        </div>
      ) : (
        <>
          <ul className="history-list">
            {rows.map((b) => (
              <li key={b.id} className="history-row">
                <span className="history-name">{b.name ?? 'Unnamed'}</span>
                <span className="stamp">{formatReleased(b.releasedAt)}</span>
              </li>
            ))}
          </ul>

          {pageCount > 1 && (
            <div className="pager">
              <PageButton
                label="previous page"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              />
              <span className="tally">
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
      className="icon-button"
    >
      <span className={flip ? 'icon-button-flip' : undefined}>
        <ArrowLeft size={14} />
      </span>
    </button>
  );
}
