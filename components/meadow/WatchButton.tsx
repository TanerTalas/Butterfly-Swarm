'use client';

import { Eye } from '@/components/ui/Icons';

/*
 * "Watch the meadow" — arayüzü kenara çekip sahneyi izlemeye geçiş.
 *
 * Yeni tasarımda ekranın SAĞ KENARINDA, dikey ortada duruyor. Yalnızca ana
 * çayır görünümlerinde (karşılama ve girişli çayır) var, kart ekranlarında
 * yok — bir formun ortasındayken "izle" demek anlamsız.
 *
 * İzleme kipinden çıkış tasarımda çizilmemiş. Sahneye tıklamak kamerayı
 * döndürdüğü için "her yere tıkla" işe yaramaz; alt ortada açık bir düğme
 * bırakıldı.
 */
export function WatchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-watch absolute top-1/2 right-6 z-20 flex h-[52px] -translate-y-1/2 items-center gap-2.5 rounded-full px-[26px] text-[15px] text-ink lg:right-[44px]"
    >
      <Eye />
      Watch the meadow
    </button>
  );
}

/** İzleme kipinden çıkış — alt ortada. */
export function StopWatchingButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-watch absolute bottom-8 left-1/2 z-20 flex h-[46px] -translate-x-1/2 items-center gap-2.5 rounded-full px-6 text-[14px] text-ink"
    >
      <Eye off />
      Leave the meadow
    </button>
  );
}
