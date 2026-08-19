'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

/*
 * Canlı çayır — üç.js sahnesinin React'e bağlandığı tek yer.
 *
 * Sahne motoru vanilla JavaScript olarak `src/` altında duruyor ve React'ten
 * habersiz. Bu bileşenin tek işi bir canvas verip `createMeadow`'u çağırmak;
 * karşılığında bir `dispose` alıyor. Sahne React state'ine tepki vermiyor,
 * dolayısıyla react-three-fiber'a gerek yok — handoff'un da önerdiği yol.
 *
 * Sahne HİÇ unmount olmuyor: gezinme sayfa içinde, kartlar çapraz geçişle
 * değişiyor. Bu yüzden bileşen kök düzende (page.tsx) bir kez asılı duruyor.
 */

type MeadowHandle = { dispose: () => void };

export function Meadow({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unsupported'>(
    'loading',
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /*
     * WebGL yoksa sahne hiç kurulmuyor ve statik bir çayır görseline
     * düşülüyor (handoff: "offline or WebGL-unavailable fallback").
     */
    if (!hasWebGL()) {
      setStatus('unsupported');
      return;
    }

    let handle: MeadowHandle | null = null;
    let cancelled = false;

    /*
     * Dinamik import: sahne + three.js ~600 kB. İlk boyaya girmemesi için
     * ayrı bir parçaya alınıyor, arayüz kartları beklemeden görünüyor.
     */
    import('@scene/world/bootstrap.js')
      .then(({ createMeadow }) => createMeadow(canvas, {}))
      .then((h) => {
        if (cancelled) {
          h.dispose();
          return;
        }
        handle = h as MeadowHandle;
        setStatus('ready');
      })
      .catch((err) => {
        console.error('[meadow] sahne kurulamadı', err);
        setStatus('unsupported');
      });

    return () => {
      cancelled = true;
      handle?.dispose();
    };
  }, []);

  return (
    <div className={`absolute inset-0 ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{
          // Sahne yüklenene kadar zemin çayırın ufuk rengiyle aynı kalsın,
          // beyaz bir flaş olmasın
          background: '#e9d3c9',
          opacity: status === 'ready' ? 1 : 0,
          transition: 'opacity 600ms ease',
        }}
      />
      {/*
       * WebGL yoksa sahnenin yakalanmış bir karesi.
       *
       * `next/image` ile servis ediliyor, CSS arka planı olarak değil: kaynak
       * dosya 2124x1464 ve 3.5 MB. Next onu isteyen ekrana göre küçültüp
       * WebP'ye çeviriyor, yani yedeğe düşen kullanıcı 3.5 MB indirmiyor.
       *
       * Yalnızca bu dal çizildiğinde isteniyor — WebGL'i olan kullanıcı
       * görseli hiç indirmiyor.
       */}
      {status === 'unsupported' && (
        <Image
          src="/meadow-fallback.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      )}
    </div>
  );
}

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    );
  } catch {
    return false;
  }
}
