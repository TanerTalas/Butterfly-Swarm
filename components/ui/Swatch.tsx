'use client';

/*
 * Renk seçimi — kanat renkleri ve profil avatarları.
 *
 * İkisi de aynı çift halkayı kullanıyor (globals.css `.ring-choice`):
 * içte kart kremi, dışta koyu. Seçili olan koyu halkayı kalıcı taşıyor,
 * hover'da daha soluk hali beliriyor.
 */

export function ColourSwatch({
  hex,
  selected,
  onSelect,
  size = 28,
  label,
}: {
  hex: string;
  selected: boolean;
  onSelect: () => void;
  size?: number;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-pressed={selected}
      data-selected={selected}
      className="ring-choice rounded-full"
      style={{ width: size, height: size, background: hex }}
    />
  );
}

/**
 * Renk çarkı düğmesi — özel renk seçiciyi açıyor.
 * Ortasındaki krem nokta onu bir renk örneğinden ayırıyor.
 */
export function ColourWheelButton({
  onClick,
  size = 28,
  active,
}: {
  onClick: () => void;
  size?: number;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="custom colour"
      aria-expanded={active}
      data-selected={active}
      className="ring-choice relative rounded-full"
      style={{
        width: size,
        height: size,
        background:
          'conic-gradient(#E05A4F,#E8A01C,#CBD45F,#2F9E4F,#17B3A3,#2F5FD0,#7A3FC4,#E05A4F)',
      }}
    >
      <span
        className="absolute left-1/2 top-1/2 rounded-full bg-card"
        style={{
          width: size * 0.36,
          height: size * 0.36,
          transform: 'translate(-50%, -50%)',
        }}
      />
    </button>
  );
}
