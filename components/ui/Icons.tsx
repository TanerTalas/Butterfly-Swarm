/*
 * İkonlar — 16-17px, çizgi kalınlığı 1.3-1.4, yuvarlak uçlar, currentColor.
 * Handoff bu ağırlığı Lucide ile eşleştiriyor; üç ikon için paket eklemeye
 * değmediğinden elle çizildiler.
 */

export function ArrowLeft({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      {/* Tasarımın yolu: chevron + gövde çizgisi */}
      <path
        d="M9.5 3.5 5 8l4.5 4.5M13 8H5.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Kapatma çarpısı — kapatılabilir bildirimlerde. */
export function Close({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <path
        d="M4 4l8 8M12 4l-8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Gear({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 17 17" aria-hidden>
      <circle
        cx="8.5"
        cy="8.5"
        r="2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M8.5 1.4v1.9M8.5 13.7v1.9M15.6 8.5h-1.9M3.3 8.5H1.4M13.5 3.5l-1.3 1.3M4.8 12.2l-1.3 1.3M13.5 13.5l-1.3-1.3M4.8 4.8 3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/*
 * Göz ikonları — şifre gösterme düğmesi.
 *
 * Kapalı hâli ayrı bir ikon değil, açık hâlin üzerine çizilen bir çizgi:
 * ikisi arasında geçerken göz aynı yerde kalıyor, yalnızca çizgi beliriyor.
 * İki farklı silüet arasında sıçramaktan daha sakin duruyor.
 */
export function Eye({ size = 17, off = false }: { size?: number; off?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 17 17" aria-hidden>
      <path
        d="M1.6 8.5S4 3.9 8.5 3.9 15.4 8.5 15.4 8.5 13 13.1 8.5 13.1 1.6 8.5 1.6 8.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="8.5"
        cy="8.5"
        r="2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      {off && (
        <path
          d="M3 14 14 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
