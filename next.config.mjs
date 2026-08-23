/*
 * Next yapılandırması ve GÜVENLİK BAŞLIKLARI.
 *
 * Başlıklar burada duruyor, bir middleware'de değil: hepsi statik değerler ve
 * middleware her istekte çalışan bir fonksiyon demek. Nonce üretilseydi
 * middleware şart olurdu — aşağıda neden üretilmediği yazıyor.
 */

/** Turnstile'ın tek konağı. Bot kontrolü bu adresten iniyor ve iframe açıyor. */
const TURNSTILE = 'https://challenges.cloudflare.com';

const dev = process.env.NODE_ENV !== 'production';

/*
 * ── İçerik Güvenliği Politikası ───────────────────────────────────────────
 *
 * Amaç: bir XSS açığı bulunsa bile enjekte edilen script'in ÇALIŞMAMASI ve
 * sayfanın bizim izin vermediğimiz hiçbir konaktan bir şey yüklememesi.
 *
 * ⚠ `'unsafe-inline'` SCRIPT'te duruyor ve bu bilinçli bir tavizdir. Temizi
 * nonce: her istekte rastgele bir değer üretip hem başlığa hem script
 * etiketlerine koymak. Ama nonce DİNAMİK RENDER gerektiriyor; yasal sayfalar
 * (`/legal/[slug]`) `generateStaticParams` ile build'de üretiliyor ve statik
 * kalması istenen şeyler (bkz. CLAUDE.md). Dört sayfayı nonce uğruna
 * dinamikleştirmek, kazandığından fazlasını götürürdü.
 *
 * ⚠ `'unsafe-inline'` STİLDE de zorunlu: satır içi `style` ÖZNİTELİKLERİ
 * (kart genişliği, renk örneği, ilerleme çubuğu — hepsi VERİ, bkz. CLAUDE.md)
 * onsuz uygulanmaz ve tasarım bozulur.
 *
 * Geliştirmede iki ek var, ikisi de üretime GİRMİYOR:
 *   'unsafe-eval'  webpack sıcak yeniden yükleme modülleri eval ile çalıştırıyor
 *   ws:            HMR bağlantısı bir websocket
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  // `frame-ancestors` X-Frame-Options'ın modern karşılığı; ikisi birden duruyor.
  "frame-ancestors 'none'",

  `script-src 'self' 'unsafe-inline' ${TURNSTILE}${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",

  /*
   * `data:` ve `blob:` — sahne kanvastan doku üretiyor (kanat atlası) ve
   * `next/image` optimize ettiği görseli kendi uç noktasından veriyor.
   */
  "img-src 'self' data: blob:",

  // Yazı tipleri `next/font` ile KENDİ sunucumuzdan; gstatic'e istek yok.
  "font-src 'self'",

  /*
   * ⚠ `blob:` BURADA da gerekiyor, `img-src`te olması yetmiyor.
   *
   * GLTFLoader model dokularını bir Blob'a yazıp `ImageBitmapLoader` ile
   * okuyor ve o loader `fetch` kullanıyor — yani blob URL'i bir GÖRSEL değil
   * bir BAĞLANTI olarak geçiyor. Eksik olduğunda semptom sinsi: sahne
   * çiziliyor, kelebekler uçuyor, yalnızca sakura ağaçları bembeyaz kalıyor
   * ve konsolda "Couldn't load texture blob:…" yazıyor.
   */
  `connect-src 'self' blob: ${TURNSTILE}${dev ? ' ws:' : ''}`,

  // Turnstile widget'ı bir iframe açıyor; başka hiçbir yere izin yok.
  `frame-src ${TURNSTILE}`,

  /*
   * ⚠ `blob:` worker için ŞART. Bugün kendi kodumuz worker açmıyor ama
   * three.js'in KTX2 transcoder'ı (CLAUDE.md → Açık işler §5) kendini blob URL'inden
   * başlatıyor; madde şimdiden burada, o iş yapıldığında sessizce kırılmasın.
   */
  "worker-src 'self' blob:",

  // Üretimde her şey HTTPS; kalan http:// bağlantıları yükseltiliyor.
  ...(dev ? [] : ['upgrade-insecure-requests']),
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  /*
   * Üç.js motoru `src/` altında düz JavaScript olarak duruyor ve TypeScript'e
   * çevrilmedi — bilinçli. O kod çalışıyor, yorumları Türkçe ve mimarisi
   * CLAUDE.md'de belgeli; tip eklemek için yeniden yazmak risk, karşılığı yok.
   * `allowJs` ile olduğu gibi import ediliyor.
   */
  transpilePackages: [],

  /*
   * ⚠ nodemailer Next'in sunucu paketlemesinin DIŞINDA bırakılıyor. Modülü
   * dinamik `require` ile yüklüyor (taşıyıcılar, DNS çözücü, kodlayıcılar);
   * paketleyici o çağrıları izleyemiyor ve derleme sessizce geçtikten sonra
   * çalışma anında "cannot find module" ile düşüyor.
   */
  serverExternalPackages: ['nodemailer'],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          /*
           * ⚠ Bu başlık DOĞRU ve kaldırılmamalı — mobil görünümü iframe'e
           * koyup denemek için bile (bkz. CLAUDE.md → Geliştirme).
           */
          { key: 'X-Frame-Options', value: 'DENY' },

          /*
           * Kullanılmayan cihaz izinleri kapatılıyor. Site kamera, mikrofon
           * ya da konum istemiyor; istemediğimiz bir şeyin açık durmasının
           * sebebi yok.
           */
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },

          /*
           * ⚠ HSTS yalnızca ÜRETİMDE. Geliştirmede http://localhost var ve
           * tarayıcıya "bu konağa hep HTTPS ile git" demek yerel geliştirmeyi
           * kilitler.
           *
           * `includeSubDomains` BİLEREK yok: alan adı henüz seçilmedi ve bir
           * alt alan adında HTTP servis edilirse geri alması bir yıl sürerdi.
           * `preload` de yok — o liste geri dönüşü zor bir taahhüt.
           */
          ...(dev
            ? []
            : [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000',
                },
              ]),
        ],
      },
    ];
  },
};

export default nextConfig;
