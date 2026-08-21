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
 *
 * ── D1: hiç kelebek yok ───────────────────────────────────────────────────
 *
 * Boş liste, dolu listenin EKSİK HÂLİ olarak okunmamalı. Eski hâlde tek
 * fark "room for 5 more butterflies" satırıydı ve buton hâlâ "Release
 * ANOTHER" diyordu — ortada bir öncesi yokken.
 *
 * Boşken kart üç şeyi birden değiştiriyor:
 *
 *   liste   → tek bir davet bloğu, kesik çizgili yuva satırı değil
 *   buton   → "Release your first butterfly"
 *   History → hiç kelebek tamamlanmamışsa GİZLİ
 *
 * Sonuncusu D2 ile birlikte verilen karar: hesabın ömründe hiçbir şey
 * olmamışsa boş bir listeden boş bir listeye gitmek bir yol değil. Geçmişte
 * bir şey varsa bağlantı duruyor — o zaman gerçekten gidilecek bir yer var.
 */
export function MyButterfliesCard({
  butterflies,
  historyCount,
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
  /**
   * Ömrünü tamamlamış kelebek sayısı — yalnızca History bağlantısının
   * görünüp görünmeyeceğine karar veriyor, ekranda hiç yazılmıyor.
   */
  historyCount?: number;
}) {
  const used = butterflies.length;
  const full = used >= SLOT_LIMIT;
  const free = Math.max(0, SLOT_LIMIT - used);
  const empty = used === 0;

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

      <div className="card-head">
        <h2 className="card-title">My butterflies</h2>
        <span className={`tally ${full ? 'tally--full' : ''}`.trim()}>
          {used}/{SLOT_LIMIT}
        </span>
      </div>

      {empty && (
        /*
         * Davet. Kesik çizgili kutunun kendisi duruyor — boşluğun dili
         * zaten o — ama içinde bir eksiklik değil bir başlangıç yazıyor.
         */
        <div className="empty-slot empty-slot--block empty-state">
          <p className="empty-state-title">Nothing is flying yet</p>
          <p className="note note--center">
            your first one flies for seven days, then the wind takes it
          </p>
        </div>
      )}

      {/*
       * Liste kartın İÇİNDE kayıyor, kartın kendisi değil — sebebi ve tavanı
       * `screens.css` → `.butterfly-list` içinde yazılı.
       */}
      {!empty && (
        <ul className="butterfly-list scrollbar-slim">
          {ordered.map((b) => (
            <li key={b.id} className="butterfly-row">
              <Butterfly
                fore={b.foreHex}
                hind={b.hindHex}
                width={33}
                height={27}
              />

              <div className="butterfly-info">
                <p className="butterfly-name">{b.name ?? 'Unnamed'}</p>
                <p className="butterfly-released">
                  released {formatReleased(b.releasedAt)}
                </p>
              </div>

              <div className="butterfly-life">
                <p className="butterfly-days">{daysLeft(b)} days left</p>
                <div className="lifebar">
                  <div
                    className="lifebar-fill"
                    style={{ width: `${(daysLeft(b) / LIFESPAN_DAYS) * 100}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => onWatch?.(b)}
                className="row-watch"
              >
                <Eye size={14} />
                Watch
              </button>
            </li>
          ))}

          {free > 0 && (
            <li className="slot-row">
              <div className="empty-slot empty-slot--row">
                <span className="note">
                  room for {free} more {free === 1 ? 'butterfly' : 'butterflies'}
                </span>
              </div>
            </li>
          )}
        </ul>
      )}

      <div className="action-stack">
        <Button size="md" fullWidth disabled={full} onClick={onRelease}>
          {full
            ? 'Max out'
            : empty
              ? 'Release your first butterfly'
              : 'Release another'}
        </Button>

        {full && (
          <p className="note note--center">
            a slot opens once one of them finishes its time
          </p>
        )}
      </div>

      {/* Boş listeden boş bir geçmişe giden bağlantı bir yol değil. */}
      {(!empty || (historyCount ?? 0) > 0) && (
        <button
          type="button"
          onClick={onHistory}
          className="text-link text-link--center"
        >
          History
        </button>
      )}
    </Card>
  );
}
