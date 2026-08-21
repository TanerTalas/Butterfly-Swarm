'use client';

import { useEffect, useRef, useState } from 'react';

/*
 * Gerçek kelebeğin önizlemesi.
 *
 * Sahnedeki sürüyle aynı geometri, aynı desen atlası, aynı çırpma shader'ı —
 * tek instance, yavaş çırpma, saydam zemin (bkz. src/world/preview.js).
 *
 * Renkler değiştiğinde sahne YENİDEN KURULMUYOR: atlas üretimi ~70ms sürüyor
 * ve her renk tıklamasında yeniden kurmak önizlemeyi takılır hale getirirdi.
 * Bunun yerine `setColours` ile instance'ın ton kaydırması güncelleniyor.
 */

type Handle = {
  setColours: (fore: string, hind: string) => void;
  dispose: () => void;
};

export function ButterflyPreview3D({
  fore,
  hind,
}: {
  fore: string;
  hind: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<Handle | null>(null);
  const [ready, setReady] = useState(false);

  // Kurulum yalnızca bir kez
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    import('@scene/world/preview.js')
      .then(({ createButterflyPreview }) =>
        createButterflyPreview(canvas, { fore, hind }),
      )
      .then((handle) => {
        if (cancelled) {
          handle.dispose();
          return;
        }
        handleRef.current = handle as Handle;
        setReady(true);
      })
      .catch((err) => {
        console.error('[preview] kelebek önizlemesi kurulamadı', err);
      });

    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
    // Renkler bilerek bağımlılık listesinde yok — aşağıdaki effect onları taşıyor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Renk değişimini sahneye ilet
  useEffect(() => {
    handleRef.current?.setColours(fore, hind);
  }, [fore, hind]);

  return (
    <div className="preview-stage">
      <canvas
        ref={canvasRef}
        className={`preview-canvas ${ready ? 'preview-canvas--ready' : ''}`.trim()}
      />
    </div>
  );
}
