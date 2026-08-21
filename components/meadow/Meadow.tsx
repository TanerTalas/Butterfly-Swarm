'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

/** Çayıra salınacak kelebeğin sahnenin ihtiyaç duyduğu KADARI. */
export type MeadowVisitor = {
  id: string;
  foreHex: string;
  hindHex: string;
};

/*
 * Sahne motorunun döndürdüğü yüz — `src/world/bootstrap.js` ile birebir.
 * Arayüz bundan fazlasını görmüyor: `swarm`, `scene`, `camera` React'e hiç
 * geçmiyor.
 */
type MeadowHandle = {
  release: (b: MeadowVisitor) => number;
  remove: (id: string) => boolean;
  clearVisitors: () => void;
  indexOf: (id: string) => number;
  watch: (id: string) => boolean;
  stopWatching: () => void;
  dispose: () => void;
};

/**
 * Arayüz ile sahne arasındaki köprü.
 *
 * `sync` BİLDİRİMSEL: "çayırda şu an bu kelebekler olmalı" diyor, "şunu
 * ekle / şunu çıkar" demiyor. Fark hesabı burada yapılıyor.
 *
 * Sebebi zamanlama. Sahne + three.js ~600 kB ve ayrı bir parça olarak
 * asenkron iniyor; kullanıcı o inmeden de kelebek salabiliyor. Emir kipinde
 * bir API bu çağrıları düşürürdü. Bildirimsel olduğu için sahne hazır
 * olmadığında istek yalnızca BEKLİYOR: `attach` anında aradaki fark
 * uygulanıyor.
 */
export type MeadowBridge = {
  sync: (list: MeadowVisitor[]) => void;
  /**
   * Kamerayı bu kelebeğe taşır; `null` izlemeyi bırakır.
   *
   * `sync` gibi bu da bir İSTEK: sahne henüz inmediyse bekliyor ve
   * kelebekler salındıktan hemen sonra uygulanıyor. Sıra önemli — izlenecek
   * kelebeğin çayırda olması gerekiyor.
   */
  watch: (id: string | null) => void;
  /** Kelebeğin sahnedeki instance indeksi; sahne hazır değilse -1. */
  indexOf: (id: string) => number;
  /** Yalnızca `Meadow` çağırır. */
  attach: (handle: MeadowHandle | null) => void;
};

function createBridge(): MeadowBridge {
  let handle: MeadowHandle | null = null;
  let wanted: MeadowVisitor[] = [];
  let watched: string | null = null;
  /** Sahneye GERÇEKTEN yazılmış olanlar. */
  const applied = new Set<string>();

  function applyWatch() {
    if (!handle) return;
    if (watched === null) handle.stopWatching();
    else handle.watch(watched);
  }

  function flush() {
    if (!handle) return;

    const ids = new Set(wanted.map((b) => b.id));

    for (const id of [...applied]) {
      if (!ids.has(id)) {
        handle.remove(id);
        applied.delete(id);
      }
    }

    for (const b of wanted) {
      if (applied.has(b.id)) continue;
      // Havuz dolduysa (-1) kelebek uygulanmış SAYILMIYOR; liste küçülüp
      // yer açıldığında bir sonraki `flush` onu tekrar deniyor.
      if (handle.release(b) >= 0) applied.add(b.id);
    }
  }

  return {
    sync(list) {
      wanted = list;
      flush();
    },
    watch(id) {
      watched = id;
      applyWatch();
    },
    indexOf(id) {
      return handle?.indexOf(id) ?? -1;
    },
    attach(next) {
      handle = next;
      applied.clear();
      flush();
      // Kelebekler salındıktan SONRA: izlenecek olanın çayırda olması lazım.
      applyWatch();
    },
  };
}

/**
 * Köprüyü bileşen ömrü boyunca TEK bir nesne olarak veriyor.
 *
 * Kimlik sabit olmak zorunda: `Garden` bunu bir effect'in bağımlılığı olarak
 * kullanıyor ve her render'da yeni bir nesne üretilseydi effect her render'da
 * yeniden çalışıp bütün kelebekleri sıfırdan salardı.
 */
export function useMeadowBridge(): MeadowBridge {
  const ref = useRef<MeadowBridge>(null);
  if (ref.current === null) ref.current = createBridge();
  return ref.current;
}

/*
 * Canlı çayır — üç.js sahnesinin React'e bağlandığı tek yer.
 *
 * Sahne motoru vanilla JavaScript olarak `src/` altında duruyor ve React'ten
 * habersiz. Bu bileşenin tek işi bir canvas verip `createMeadow`'u çağırmak;
 * karşılığında bir `dispose` ve dar bir kelebek yüzü alıyor.
 *
 * Sahne hazır olduğunda gelen handle KÖPRÜYE takılıyor (`bridge.attach`) ve
 * o ana kadar biriken kelebekler oracıkta salınıyor. `Garden` bu bekleyişi
 * hiç görmüyor.
 *
 * Sahne HİÇ unmount olmuyor: gezinme sayfa içinde, kartlar çapraz geçişle
 * değişiyor. Bileşen kök düzende bir kez asılı duruyor.
 */

export function Meadow({
  className,
  bridge,
}: {
  className?: string;
  bridge?: MeadowBridge;
}) {
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
        bridge?.attach(handleRef.current);
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
      bridge?.attach(null);
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [bridge]);

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
