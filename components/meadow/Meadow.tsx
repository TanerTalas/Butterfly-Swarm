'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

/*
 * Canlı çayır — üç.js sahnesinin React'e bağlandığı tek yer.
 *
 * Sahne motoru vanilla JavaScript olarak `src/` altında duruyor ve React'ten
 * habersiz. Bu bileşenin tek işi bir canvas verip `createMeadow`'u çağırmak;
 * karşılığında bir `dispose` alıyor.
 *
 * Sahne HİÇ unmount olmuyor: gezinme sayfa içinde, kartlar çapraz geçişle
 * değişiyor. Bileşen kök düzende bir kez asılı duruyor.
 */

type MeadowHandle = { dispose: () => void };

export function Meadow({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unsupported'>(
    'loading',
  );

  /*
   * TEK KURULUM KİLİDİ.
   *
   * React StrictMode geliştirmede her effect'i iki kez çalıştırıyor:
   * kur → temizle → kur. Sıradan bir effect için zararsız, ama burada
   * `createMeadow` ASENKRON ve pahalı. İki çağrı aynı anda başlıyor,
   * ikisi de AYNI canvas üzerinde bir WebGLRenderer kuruyor — bir
   * canvas'ın tek bağlamı olduğu için iki renderer tek bağlamı paylaşıyor,
   * iki animasyon döngüsü birden dönüyor ve sahne iki kez inşa ediliyor
   * (iki kez 46.000 çim, iki gökyüzü pişirmesi, iki gölge geçişi).
   *
   * Sonuç ölçüldü: kare hızı 2'ye düşüyordu. Temizlik fonksiyonundaki
   * `cancelled` bayrağı yetmiyor, çünkü ikinci çağrı birincisi daha
   * çözülmeden başlıyor.
   *
   * Bu yüzden bayrak temizlikte SIFIRLANMIYOR: sahne sayfa ömrü boyunca
   * tek olmalı ve zaten hiç unmount olmuyor.
   */
  const startedRef = useRef(false);
  const handleRef = useRef<MeadowHandle | null>(null);

  useEffect(() => {
    if (startedRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    /*
     * WebGL yoksa sahne hiç kurulmuyor ve statik bir çayır görseline
     * düşülüyor.
     */
    if (!hasWebGL()) {
      setStatus('unsupported');
      return;
    }

    startedRef.current = true;

    /*
     * Dinamik import: sahne + three.js ~600 kB. İlk boyaya girmemesi için
     * ayrı bir parçaya alınıyor, arayüz kartları beklemeden görünüyor.
     */
    import('@scene/world/bootstrap.js')
      .then(({ createMeadow }) => createMeadow(canvas, {}))
      .then((h) => {
        handleRef.current = h as MeadowHandle;
        setStatus('ready');
      })
      .catch((err) => {
        console.error('[meadow] sahne kurulamadı', err);
        setStatus('unsupported');
      });

    return () => {
      /*
       * Sayfa gerçekten kapanırken serbest bırak. StrictMode'un sahte
       * temizliği de buraya düşüyor ama o an `handleRef` henüz boş, yani
       * zararsız — ve bayrak sıfırlanmadığı için ikinci kurulum hiç
       * başlamıyor.
       */
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  return (
    <div className={`meadow-layer ${className ?? ''}`.trim()}>
      <canvas
        ref={canvasRef}
        className={`meadow-canvas ${status === 'ready' ? 'meadow-canvas--ready' : ''}`.trim()}
      />

      {/*
       * WebGL yoksa sahnenin yakalanmış bir karesi.
       *
       * `next/image` ile servis ediliyor, CSS arka planı olarak değil: kaynak
       * dosya 2124x1464 ve 3.5 MB. Next onu isteyen ekrana göre küçültüp
       * WebP'ye çeviriyor.
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
          className="meadow-fallback"
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
