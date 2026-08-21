/*
 * Kelebek işareti — tek çizim, her yerde.
 *
 * Handoff prototipindeki kelebekler bilinçli yer tutucuydu: `border-radius`
 * lekeleri, dört elips, iki yuvarlak dikdörtgen. Bu onların yerine geçen
 * gerçek çizim.
 *
 * Kanatlar AYRI yollar (`fore-*`, `hind-*`) çünkü ön ve arka kanat bağımsız
 * renkleniyor — kayıtlı kullanıcıların iki renkli kelebekleri (projefikri.md
 * §2). Sol kanatlar sağın aynası: `scale(-1,1)` ile üretiliyorlar, böylece
 * simetri elle çizilen iki yolun tutmasına bağlı değil.
 *
 * Tek bileşen üç boyutta kullanılıyor (handoff tablosu):
 *   salma önizlemesi ~124×100 · profil avatarı 19–42px · liste satırı ~33×24
 */

type ButterflyProps = {
  /** Ön kanat rengi (hex). */
  fore: string;
  /** Arka kanat rengi. Verilmezse ön kanatla aynı — tek renk kelebek. */
  hind?: string;
  width?: number;
  height?: number;
  /** Avatar kipi: gövde ve antenler sadeleşiyor, küçük boyda karışmasınlar. */
  simple?: boolean;
  className?: string;
  title?: string;
};

const BODY = '#43332F';

/* Sağ kanatlar; sol taraf bunların aynası. */
const FORE_RIGHT =
  'M63 34 C70 19, 88 5, 103 6 C117 7, 121 21, 112 34 C104 45, 84 51, 68 46 Z';
const HIND_RIGHT =
  'M65 48 C77 48, 95 53, 100 63 C106 74, 98 87, 86 86 C73 85, 65 74, 63 60 Z';

export function Butterfly({
  fore,
  hind,
  width = 124,
  height = 100,
  simple = false,
  className,
  title,
}: ButterflyProps) {
  const hindColor = hind ?? fore;

  return (
    <svg
      viewBox="0 0 124 100"
      width={width}
      height={height}
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* Arka kanatlar önce: ön kanatların altında kalsınlar */}
      <path id="hind-right" d={HIND_RIGHT} fill={hindColor} />
      <path
        id="hind-left"
        d={HIND_RIGHT}
        fill={hindColor}
        transform="scale(-1,1) translate(-124,0)"
      />

      <path id="fore-right" d={FORE_RIGHT} fill={fore} />
      <path
        id="fore-left"
        d={FORE_RIGHT}
        fill={fore}
        transform="scale(-1,1) translate(-124,0)"
      />

      {/* Gövde: başta kalın, kuyruğa doğru incelen tek yol */}
      <path
        id="body"
        d="M62 21 C66 21, 68 26, 68 33 L68 61 C68 73, 65 82, 62 85 C59 82, 56 73, 56 61 L56 33 C56 26, 58 21, 62 21 Z"
        fill={BODY}
      />

      {!simple && (
        <g
          id="antennae"
          stroke={BODY}
          strokeWidth={2.2}
          strokeLinecap="round"
          fill="none"
        >
          <path d="M60 23 C55 15, 48 9, 42 7" />
          <path d="M64 23 C69 15, 76 9, 82 7" />
          <circle cx="41" cy="6" r="2.4" fill={BODY} stroke="none" />
          <circle cx="83" cy="6" r="2.4" fill={BODY} stroke="none" />
        </g>
      )}
    </svg>
  );
}

/**
 * Avatar kipi: krem daire içinde tek renk kelebek.
 * Profil rozetlerinde ve hesap kartında kullanılıyor.
 */
export function ButterflyAvatar({
  colour,
  size = 42,
  circle = 68,
  className,
}: {
  colour: string;
  size?: number;
  circle?: number;
  className?: string;
}) {
  return (
    <span
      className={`avatar ${className ?? ''}`.trim()}
      style={{ width: circle, height: circle }}
    >
      <Butterfly
        fore={colour}
        width={size}
        height={size * (100 / 124)}
        simple
      />
    </span>
  );
}
