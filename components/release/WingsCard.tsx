'use client';

import { useState } from 'react';
import { Butterfly } from '@/components/Butterfly';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Label } from '@/components/ui/Field';
import { ColourSwatch, ColourWheelButton } from '@/components/ui/Swatch';
import { ColourPicker } from '@/components/release/ColourPicker';
import { NAME_MAX, SLOT_LIMIT, WING_COLOURS } from '@/lib/types';

/*
 * Ekran 07 — kanat seçimi (yalnızca üyeler).
 *
 * Handoff'un 1 numaralı değişikliği: soldaki önizleme CANLI. Kullanıcı renk
 * seçtikçe gerçekten salacağı kelebeği görüyor, statik bir yer tutucu değil.
 *
 * "Preview" eylemi kelebeği büyük halde, çayır bulanıklaştırılmış bir
 * katmanda gösteriyor ve salmadan kapatılabiliyor.
 *
 * ⚠ Handoff bu önizlemenin İDEALDE gerçek 3B kelebek olmasını istiyor
 * (sürünün geometrisi ve materyaliyle, tek instance, yavaş çırpma).
 * Şimdilik aynı SVG büyük boyda kullanılıyor; 3B önizleme ayrı bir iş.
 */
export function WingsCard({
  slotsUsed,
  onRelease,
  pending,
}: {
  slotsUsed: number;
  onRelease: (name: string, fore: string, hind: string) => void;
  pending?: boolean;
}) {
  const [fore, setFore] = useState<string>(WING_COLOURS[0].hex);
  const [hind, setHind] = useState<string>(WING_COLOURS[1].hex);
  const [name, setName] = useState('');
  const [picker, setPicker] = useState<null | 'fore' | 'hind'>(null);
  const [preview, setPreview] = useState(false);

  const trimmed = name.trim();

  return (
    <>
      <Card width={520}>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-[28px] leading-tight text-ink lg:text-[32px]">
            Choose its wings
          </h2>
          <span className="font-mono text-[12px] tracking-[0.14em] text-faint">
            {slotsUsed}/{SLOT_LIMIT}
          </span>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {/* Canlı önizleme — seçimle birlikte değişiyor */}
          <div className="flex shrink-0 items-center justify-center self-center rounded-[14px] bg-panel p-3 sm:self-start">
            <Butterfly fore={fore} hind={hind} width={124} height={100} />
          </div>

          <div className="flex flex-1 flex-col gap-5">
            <WingRow
              label="forewing"
              value={fore}
              onSelect={setFore}
              pickerOpen={picker === 'fore'}
              onTogglePicker={() =>
                setPicker(picker === 'fore' ? null : 'fore')
              }
              onCommit={(hex) => {
                setFore(hex);
                setPicker(null);
              }}
              onClosePicker={() => setPicker(null)}
            />
            <WingRow
              label="hindwing"
              value={hind}
              onSelect={setHind}
              pickerOpen={picker === 'hind'}
              onTogglePicker={() =>
                setPicker(picker === 'hind' ? null : 'hind')
              }
              onCommit={(hex) => {
                setHind(hex);
                setPicker(null);
              }}
              onClosePicker={() => setPicker(null)}
            />
          </div>
        </div>

        <Field
          label="name"
          display
          maxLength={NAME_MAX}
          placeholder="Mint"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint={`${name.length}/${NAME_MAX}`}
        />

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            className="flex-1"
            disabled={pending || trimmed.length === 0}
            onClick={() => onRelease(trimmed, fore, hind)}
          >
            {pending ? 'Letting it go…' : 'Let it go'}
          </Button>
          <Button variant="secondary" onClick={() => setPreview(true)}>
            Preview
          </Button>
        </div>
      </Card>

      {preview && (
        <PreviewOverlay
          fore={fore}
          hind={hind}
          name={trimmed}
          onClose={() => setPreview(false)}
        />
      )}
    </>
  );
}

/** Tek kanat çifti için etiket, değer, örnekler ve çark. */
function WingRow({
  label,
  value,
  onSelect,
  pickerOpen,
  onTogglePicker,
  onCommit,
  onClosePicker,
}: {
  label: string;
  value: string;
  onSelect: (hex: string) => void;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onCommit: (hex: string) => void;
  onClosePicker: () => void;
}) {
  const named = WING_COLOURS.find((c) => c.hex.toUpperCase() === value.toUpperCase());

  return (
    <div className="relative flex flex-col gap-3">
      <span className="flex items-baseline justify-between gap-3">
        <Label>{label}</Label>
        <span className="font-mono text-[11px] tracking-[0.14em] text-faint">
          {named ? `${named.name} · ` : 'custom · '}
          {value.toUpperCase()}
        </span>
      </span>

      <div className="flex flex-wrap items-center gap-3">
        {WING_COLOURS.map((c) => (
          <ColourSwatch
            key={c.hex}
            hex={c.hex}
            label={c.name}
            selected={c.hex.toUpperCase() === value.toUpperCase()}
            onSelect={() => onSelect(c.hex)}
          />
        ))}
        <ColourWheelButton active={pickerOpen} onClick={onTogglePicker} />
      </div>

      {pickerOpen && (
        <ColourPicker
          initial={value}
          onCommit={onCommit}
          onClose={onClosePicker}
        />
      )}
    </div>
  );
}

/*
 * Önizleme katmanı — kelebeği büyük halde gösteriyor.
 * Çayır arkada bulanıklaşıyor ama görünür kalıyor; salmadan kapatılabilir.
 */
function PreviewOverlay({
  fore,
  hind,
  name,
  onClose,
}: {
  fore: string;
  hind: string;
  name: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 p-6"
      style={{
        background: 'rgba(247,239,233,0.72)',
        backdropFilter: 'blur(10px)',
      }}
      role="dialog"
      aria-label="butterfly preview"
    >
      <Butterfly fore={fore} hind={hind} width={320} height={258} />

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-display text-[32px] text-ink">
          {name || 'Your butterfly'}
        </p>
        <p className="font-mono text-[11px] tracking-[0.14em] text-faint">
          {fore.toUpperCase()} · {hind.toUpperCase()}
        </p>
      </div>

      <Button variant="secondary" onClick={onClose}>
        Back to the colours
      </Button>
    </div>
  );
}
