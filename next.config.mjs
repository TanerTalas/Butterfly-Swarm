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
   * three.js sahnesi worker ve blob URL'i kullanabiliyor; CSP eklerken
   * `worker-src blob:` gerekiyor (bkz. handoff güvenlik bölümü).
   * Başlıklar Aşama E'de tamamlanacak, buradaki set temel olanlar.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
