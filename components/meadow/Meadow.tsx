'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

/** Çayıra salınacak kelebeğin sahnenin ihtiyaç duyduğu KADARI. */
export type MeadowVisitor = {
  id: string;
  foreHex: string;
  hindHex: string;
  /**
   * Görünüş çekilişlerinin tohumu — SUNUCUDAN geliyor.
   *
   * ⚠ Yuvalar geri dönüşümlü: dokunulmazsa kelebek hangi yuvaya düştüyse onun
   * boyunu ve giriş kenarını alır, yani yenilemeden sonra başka türlü görünür.
   * Eksikse sahne kimlikten türetiyor (`visitors.js` → `hashSeed`) — geçerli
   * bir yedek, ama sunucunun verdiği değer tercih ediliyor.
   */
  seed?: number;
  /**
   * Ömrün iki ucu — kelebeğin çayırda ne kadar solmuş görüneceği bu
   * aralıktan türüyor. İkisi birden verilmezse kelebek hiç solmuyor.
   *
   * Sahne kalan oranı her karede kendisi hesaplıyor, yani liste yeniden
   * gönderilmese de solma ilerliyor.
   *
   * Bu bir GÖSTERİM değeri, uygunluk değil: kelebeğin ne zaman listeden
   * düşeceğine sunucu karar veriyor, sahne yalnızca gördüğünü çiziyor —
   * `daysLeft()`in ilerleme çubuğunu çizmesi gibi. Tam solmuş bir kelebek
   * çayırda görünmez olur ama KALKMAZ.
   */
  releasedAt?: Date;
  expiresAt?: Date;
  /**
   * Misafir mi üye mi — çayırdaki iki kontenjandan hangisine sayılacağı.
   *
   * Verilmezse misafir sayılıyor: yanlış tarafa düşmesi hâlinde daha
   * güvenli olan taraf o (misafir kontenjanı küçük ve dolduğunda sessizce
   * yem kelebeğe düşülüyor; üye kontenjanına yanlışlıkla sayılan bir
   * kelebek gerçek bir üyenin yerini yerdi).
   */
  kind?: 'guest' | 'member';
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

/** Sahnenin kurulum durumu — `Garden` bunu kabuğa taşıyor. */
export type MeadowStatus = 'loading' | 'ready' | 'unsupported';

export function Meadow({
  className,
  bridge,
  onStatus,
}: {
  className?: string;
  bridge?: MeadowBridge;
  /**
   * Sahne hazır olduğunda / olamadığında haber veriyor.
   *
   * Sahne kendi başına bir açıklama ÇİZMİYOR (bkz. aşağıdaki not): açıklama
   * kabuğun işi, çünkü kabuk sayaç ve rozetle aynı akışta duruyor ve orada
   * hiçbir genişlikte çakışma olmuyor.
   */
  onStatus?: (status: MeadowStatus) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<MeadowStatus>('loading');

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

  /*
   * Durum değişimi kurulum effect'inden AYRI bildiriliyor.
   *
   * `onStatus`u doğrudan `setStatus`un yanında çağırmak, `Garden`ın render'ı
   * sürerken orada durum güncellemek demek. Ayrı bir effect bunu commit
   * sonrasına taşıyor — ve `onStatus` her render'da yeni bir fonksiyon olsa
   * bile bağımlılıkta `status` olduğu için yalnızca durum değişince
   * çalışıyor.
   */
  useEffect(() => {
    onStatus?.(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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
      {/*
       * D7 — YER TUTUCU.
       *
       * Sahne + three.js ~600 kB ve ayrı bir parça olarak iniyor; kartlar
       * hemen görünüyor ama arkadaki çayır boş. Eskiden o boşluk düz bir
       * ufuk rengiydi ve yavaş bağlantıda kullanıcı bir şeyin yüklendiğini
       * hiç bilmiyordu.
       *
       * Yer tutucu YAKALANMIŞ BİR KARE DEĞİL, tokenlardan çizilmiş bir
       * gökyüzü/ufuk/zemin gradyanı. `meadow-fallback.png` duruyor ama 3.5
       * MB: yükleme sırasında indirmek, yükleme göstergesini yüklemenin
       * kendisinden pahalı yapardı. Gradyan bedava ve ilk boyada hazır.
       *
       * Yükleniyor SİNYALİ ufuk boyunca yavaşça geçen bir ışık. Metin
       * bilerek yok: karşılama başlığı bu katmanın üstünde duruyor ve
       * sahnenin arka planı onunla konuşmaya kalkmamalı. Ekran okuyucuya
       * ise söyleniyor — aşağıdaki `role="status"`.
       *
       * `aria-hidden`: gördüğü şey bir resim değil, henüz olmayan bir
       * sahnenin yeri.
       */}
      {status === 'loading' && (
        <>
          <div className="meadow-placeholder" aria-hidden>
            <div className="meadow-placeholder-sweep" />
          </div>
          <p className="visually-hidden" role="status">
            the meadow is loading
          </p>
        </>
      )}

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
      {/*
       * D8 — sahne çizilemedi.
       *
       * Burada yalnızca yakalanmış kare var; AÇIKLAMA kabukta
       * (`MeadowShell` → `SceneNotice`). Bir zamanlar buradaydı ve sahne
       * katmanına mutlak konumla yapıştırılmıştı: 390px'te sağ üstteki
       * sayacın üstüne biniyordu. Kabukta akışın içinde durduğu için artık
       * hiçbir genişlikte hiçbir şeye binemiyor.
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
