'use client';

import { Button } from '@/components/ui/Button';

/*
 * Ekran 03 — salındı onayı.
 *
 * Kart YOK, bilinçli: salma anı bir form adımı değil, bir duraklama.
 * Metin doğrudan çayırın üstünde duruyor ve sağ üstteki sayaç artmış oluyor.
 *
 * İSİM KURALI. Tasarımda örnek metin "Mint is flying." ama misafir
 * kelebeklerinin ismi yok. Karar verildi: misafire otomatik isim
 * UYDURULMUYOR, cümle isimsiz kuruluyor — "Your butterfly is flying."
 *
 * Sebebi tutarlılık: misafir kelebeğini takip edemiyor, "Mint" diye bir
 * isim vermek takip edilebilirmiş izlenimi yaratırdı.
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
  /*
   * Yalnızca TARİH — saat yok (sahibinin kararı).
   *
   * Önce "20 august 2026 at 13:57" yazıyordu. Dakika hassasiyeti bu ekranda
   * yanlış bir söz veriyor: kelebeğin ömrü gün cinsinden sayılıyor
   * (`daysLeft`), saat hiçbir yerde kullanılmıyor ve hiçbir şeyi
   * değiştirmiyor.
   */
  const stamp = releasedAt
    .toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    .toLowerCase();

  return (
    <div className="meadow-view">
      <p className="eyebrow">{stamp}</p>

      <h2 className="meadow-view-title meadow-view-title--released">
        {name ? `${name} is flying.` : 'Your butterfly is flying.'}
      </h2>

      <p className="meadow-view-lede">
        Seven days from now. Look for it in the meadow.
      </p>

      <div className="action-row">
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
