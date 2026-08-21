'use client';

import { Eye } from '@/components/ui/Icons';

/*
 * "Watch the meadow" — arayüzü kenara çekip sahneyi izlemeye geçiş.
 *
 * Yeri kırılma noktasına göre değişiyor ve karar CSS'te (`shell.css`):
 *
 *   masaüstü — ekranın sağ kenarında, dikey ortada
 *   mobil    — sayaçla asıl arayüzün ARASINDA, akışın içinde
 *
 * Mobilde kenara sabitlendiğinde karşılama başlığının üstüne biniyor ve iki
 * metin iç içe geçiyordu; dar ekranda "sahnenin üstünde yüzen denetim"
 * kalıbının yeri yok.
 *
 * Yalnızca ana çayır görünümlerinde (karşılama ve girişli çayır) çiziliyor,
 * kart ekranlarında değil — bir formun ortasındayken "izle" demek anlamsız.
 *
 * İzleme kipinden çıkış tasarımda çizilmemiş. Sahneye tıklamak kamerayı
 * döndürdüğü için "her yere tıkla" işe yaramaz; alt ortada açık bir düğme
 * bırakıldı.
 */
export function WatchButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="meadow-control">
      <Eye />
      Watch the meadow
    </button>
  );
}

/** İzleme kipinden çıkış — alt ortada. */
export function StopWatchingButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="meadow-control-exit">
      <Eye off />
      Leave the meadow
    </button>
  );
}
