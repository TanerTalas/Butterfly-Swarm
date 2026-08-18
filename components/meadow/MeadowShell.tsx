import Link from 'next/link';
import type { ReactNode } from 'react';

/*
 * Çayır ekranlarının ortak kabuğu.
 *
 * Bütün çayır ekranları (01–12) aynı iskeleti paylaşıyor: canlı sahne, metnin
 * okunması için soldan sağa açılan bir perde, 72px kenar boşluğu, sağ üstte
 * sayaç, sağ altta yasal bağlantılar.
 *
 * Perde bir "karartma" değil, YÖNLÜ bir geçiş: solda krem neredeyse opak,
 * sağda tamamen şeffaf. Böylece kartlar okunurken çayır da görünür kalıyor.
 * Yoğunluk ekrana göre biraz değişiyor (veda ve ayarlar ekranları daha ağır),
 * o yüzden parametre.
 */

const LEGAL = [
  { href: '/legal/privacy', label: 'privacy' },
  { href: '/legal/terms', label: 'terms' },
  { href: '/legal/cookies', label: 'cookies' },
  { href: '/legal/contact', label: 'contact' },
];

export function MeadowShell({
  children,
  scrim = 'default',
  counter,
  topRight,
}: {
  children: ReactNode;
  scrim?: 'default' | 'heavy';
  counter?: ReactNode;
  topRight?: ReactNode;
}) {
  const gradient =
    scrim === 'heavy'
      ? 'linear-gradient(90deg, rgba(247,239,233,0.96) 0%, rgba(247,239,233,0.80) 34%, rgba(247,239,233,0) 62%)'
      : 'linear-gradient(90deg, rgba(247,239,233,0.94) 0%, rgba(247,239,233,0.74) 34%, rgba(247,239,233,0) 60%)';

  return (
    <>
      {/* Perde — sahnenin üstünde, arayüzün altında */}
      <div
        className="pointer-events-none absolute inset-0 max-lg:hidden"
        style={{ background: gradient }}
        aria-hidden
      />
      {/*
       * Mobilde perde YÖNÜ değişiyor: içerik altta toplandığı için geçiş
       * soldan sağa değil, yukarıdan aşağıya. Masaüstü gradyanını döndürüp
       * kullanmak metni okunmaz bırakıyordu.
       */}
      <div
        className="pointer-events-none absolute inset-0 lg:hidden"
        style={{
          background:
            'linear-gradient(180deg, rgba(247,239,233,0) 0%, rgba(247,239,233,0.55) 42%, rgba(247,239,233,0.95) 72%)',
        }}
        aria-hidden
      />

      {/*
       * Köşe parlaklığı.
       *
       * Tasarım sabit bir arka plan karesi üzerine çizilmişti; sağ üstteki
       * sayaç ve sağ alttaki yasal bağlantılar orada açık renkli çimenin
       * üstüne denk geliyordu. Sahne CANLI ve döndürülebilir — arkalarına
       * koyu bir gövde ya da çiçek kümesi geldiğinde koyu metin tamamen
       * okunmaz oluyor.
       *
       * Çözüm perdeyi büyütmek değil (o çayırı yutuyor), köşelere yumuşak
       * birer krem hâle koymak. Metnin altında kalıyor, kenarları görünmüyor.
       */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 42% at 100% 0%, rgba(247,239,233,0.82) 0%, rgba(247,239,233,0) 70%), radial-gradient(52% 34% at 100% 100%, rgba(247,239,233,0.72) 0%, rgba(247,239,233,0) 72%)',
        }}
        aria-hidden
      />

      <div className="absolute inset-0 flex flex-col p-6 lg:p-[72px]">
        {/* Üst şerit: sağda sayaç ve (varsa) hesap rozeti */}
        <div className="flex items-start justify-end gap-4">
          {topRight}
          {counter}
        </div>

        {/*
         * İçerik masaüstünde dikey ortada, mobilde alta yaslı — handoff'un
         * mobil kalıbı: tek sütun, içerik ekranın altına sabitlenmiş.
         */}
        <div className="flex flex-1 items-end lg:items-center">
          <div className="w-full">{children}</div>
        </div>

        <div className="flex justify-center pt-6 lg:justify-end lg:pt-0">
          <nav className="flex gap-[18px]">
            {LEGAL.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="meta transition-colors hover:text-accent"
                style={{ textShadow: '0 1px 10px rgba(247,239,233,0.95)' }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}

/** Sağ üstteki küresel salım sayacı. */
export function ReleaseCounter({ total }: { total: number }) {
  return (
    <div
      className="text-right"
      /*
       * Krem renkli metin gölgesi: köşe hâlesinin yetmediği durumlarda
       * (kamera koyu bir gövdeye döndüğünde) harflerin çevresinde ince bir
       * okunabilirlik payı bırakıyor.
       */
      style={{ textShadow: '0 1px 12px rgba(247,239,233,0.95)' }}
    >
      <div className="eyebrow">released into the meadow</div>
      <div className="mt-2 font-display text-[34px] leading-none text-ink">
        {total.toLocaleString('en-US')}
      </div>
    </div>
  );
}
