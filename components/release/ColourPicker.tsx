'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { fieldColour, parseHex } from '@/lib/colour';

/*
 * Özel renk seçici.
 *
 * ── Tıklama artık RENGİ SEÇİYOR ────────────────────────────────────────────
 *
 * İlk sürümde alana tıklamak yalnızca yerel bir taslağı değiştiriyordu ve
 * rengin kanada geçmesi için "Use this colour" gerekiyordu. Kullanıcı
 * açısından tıklamak hiçbir şey yapmıyor gibi görünüyordu: imleç kımıldadığı
 * an hex kutusu yine değişiyordu.
 *
 * Şimdi tıklamak rengi ANINDA kanada uyguluyor ve kilitliyor. Gezinme hâlâ
 * önizleme yapıyor (handoff'un 3 numaralı değişikliği) ama seçili renk
 * yalnızca tıklamayla değişiyor. Böylece üç durum net ayrılıyor:
 *
 *   selected — kanadın gerçekten taşıdığı renk, yalnızca tıklamayla değişir
 *   hover    — imlecin altındaki, hiçbir şeye uygulanmayan
 *   text     — hex kutusunun içeriği; gezinirken hover'ı, yoksa selected'ı gösterir
 *
 * ── Çarka tekrar tıklamak kapatıyor ───────────────────────────────────────
 *
 * Dışarı tıklamayı yakalayan `mousedown` dinleyicisi çark düğmesini de
 * "dışarı" sayıyordu: mousedown kapatıyor, hemen ardından gelen click
 * toggle'ı tekrar açıyordu. Seçici hiç kapanmıyor gibi görünüyordu.
 * Dinleyici artık `[data-colour-wheel]` taşıyan öğeleri atlıyor; kapatma
 * kararını toggle'a bırakıyor.
 */
export function ColourPicker({
  selected,
  onSelect,
  onClose,
  side = 'right',
}: {
  /** Kanadın hâlihazırda taşıdığı renk. */
  selected: string;
  /** Tıklamayla seçilen rengi ANINDA uygular. */
  onSelect: (hex: string) => void;
  onClose: () => void;
  side?: 'right' | 'left';
}) {
  const [hue, setHue] = useState(170);
  const [hover, setHover] = useState<string | null>(null);
  const [text, setText] = useState(selected);

  /*
   * Tıklanan noktanın işareti.
   *
   * Alanda seçili rengin NEREDE olduğunu gösteren tek şey buydu ve yoktu:
   * tıkladıktan sonra imleç kımıldayınca geriye hiçbir iz kalmıyordu, hangi
   * noktayı seçtiğini görmek imkânsızdı. İşaret imlecin artısını taklit
   * ediyor — tıkladığın yerde duran bir nişan.
   *
   * Renk değil KONUM saklanıyor (0–1 aralığında oranlar). Böylece ton
   * çubuğu oynatıldığında işaret yerinde kalıp yeni tonun aynı doygunluk/
   * parlaklık noktasını gösterebiliyor.
   */
  const [mark, setMark] = useState<{ sx: number; sy: number } | null>(null);

  const fieldRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const shown = hover ?? selected;

  useEffect(() => {
    setText(shown);
  }, [shown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (popRef.current?.contains(target)) return;
      // Çark düğmesi kendi kapatmasını yönetiyor — bkz. üstteki not
      if (target?.closest('[data-colour-wheel]')) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  function pointAt(e: React.MouseEvent) {
    const el = fieldRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const sx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const sy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    return { sx, sy, hex: fieldColour(hue, sx, sy) };
  }

  const desktopSide =
    side === 'right'
      ? 'lg:left-[calc(100%+20px)] lg:top-[-4px]'
      : 'lg:right-[calc(100%+20px)] lg:top-[-4px]';

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label="custom colour"
      className={`absolute inset-x-0 bottom-[calc(100%+14px)] z-30 mx-auto w-[240px] rounded-[16px] p-4 lg:inset-x-auto lg:bottom-auto lg:mx-0 ${desktopSide}`}
      style={{
        backgroundColor: '#FDF6F2',
        border: '1px solid rgba(44,34,32,0.08)',
        boxShadow: '0 18px 42px rgba(74,59,56,0.28)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow">custom colour</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="close"
          className="text-muted transition-colors hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div
        ref={fieldRef}
        onMouseMove={(e) => setHover(pointAt(e)?.hex ?? null)}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const p = pointAt(e);
          if (p) {
            onSelect(p.hex);
            setMark({ sx: p.sx, sy: p.sy });
            setHover(null); // tıklanan renk kilitlensin, imleç kımıldasa da
          }
        }}
        className="relative h-[78px] w-full cursor-crosshair rounded-[8px]"
        style={{
          background: `linear-gradient(180deg, transparent, #17231F), linear-gradient(90deg, #F6EFE9, ${fieldColour(hue, 1, 0)})`,
        }}
      >
        {mark && (
          /*
           * Nişan iki kat çizgiden oluşuyor: altta kalın beyaz, üstte ince
           * koyu. Alan bir köşesinde neredeyse beyaz, diğerinde neredeyse
           * siyah — tek renk bir artı ikisinden birinde mutlaka kayboluyor.
           * İki kat her zeminde okunuyor.
           *
           * `pointer-events-none` şart: nişan alanın üstünde duruyor ve
           * tıklamayı yutarsa kendi üzerine ikinci kez seçim yapılamıyor.
           */
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            className="pointer-events-none absolute"
            style={{
              left: `${mark.sx * 100}%`,
              top: `${mark.sy * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
            aria-hidden
          >
            <path
              d="M7.5 1v13M1 7.5h13"
              stroke="rgba(255,255,255,0.95)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M7.5 1v13M1 7.5h13"
              stroke="rgba(28,22,20,0.85)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      <input
        type="range"
        min={0}
        max={359}
        value={hue}
        onChange={(e) => {
          const h = Number(e.target.value);
          setHue(h);
          /*
           * İşaret duruyorsa seçili renk onunla birlikte geziyor. Yoksa
           * arayüz kendiyle çelişirdi: nişan bir noktayı gösterirken kanat
           * başka bir rengi taşırdı.
           */
          if (mark) onSelect(fieldColour(h, mark.sx, mark.sy));
        }}
        aria-label="hue"
        className="mt-3 h-3 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background:
            'linear-gradient(90deg,#E05A4F,#E8A01C,#CBD45F,#2F9E4F,#17B3A3,#2F5FD0,#7A3FC4,#E05A4F)',
        }}
      />

      <div className="mt-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const parsed = parseHex(e.target.value);
            // Yazılan geçerli bir renk de anında uygulanıyor
            if (parsed) {
              onSelect(parsed);
              /*
               * Nişan kalkıyor: elle yazılan rengin alanda bir karşılığı
               * yok. Bıraksaydık işaret artık seçili olmayan bir noktayı
               * gösterirdi.
               */
              setMark(null);
            }
          }}
          spellCheck={false}
          aria-label="hex value"
          className="h-[38px] min-w-0 flex-1 rounded-[10px] border border-[rgba(44,34,32,0.16)] bg-input px-3 font-mono text-[13px] text-ink outline-none focus:border-[rgba(44,34,32,0.34)]"
        />
        <span
          className="h-[38px] w-[38px] shrink-0 rounded-[10px] border border-[rgba(44,34,32,0.12)]"
          style={{ background: shown }}
          aria-hidden
        />
      </div>

      {/*
       * Renk zaten tıklamayla uygulandığı için bu buton "onayla" değil
       * "bitti" demek: seçiciyi kapatıyor.
       */}
      <Button size="sm" fullWidth className="mt-3 h-[40px]" onClick={onClose}>
        Done
      </Button>

      <p className="mt-2 font-mono text-[10px] leading-[1.5] tracking-[0.12em] text-faint">
        hex is optional · pinks disappear against the sakura
      </p>
    </div>
  );
}
