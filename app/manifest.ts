import type { MetadataRoute } from 'next';

/*
 * Web uygulama künyesi — `/manifest.webmanifest`.
 *
 * Next bunu bir metadata rotası olarak tanıyor ve `<link rel="manifest">`
 * etiketini kendisi basıyor; layout'ta elle bir satır yok.
 *
 * ⚠ SİMGELER `public/icons/` ALTINDA, `app/` altında DEĞİL. Sebebi adresin
 * sabit kalması: `app/` içindeki simge dosyalarını Next içeriğin özetiyle
 * damgalıyor (`/icon.svg?a1b2c3`), yani buraya yazılabilecek sabit bir yol
 * yok. Künyenin gösterdiği dosyalar bu yüzden `public/`ten servis ediliyor.
 *
 * ⚠ `maskable` AYRI BİR DOSYA. Android maskeli simgeyi kendi şekline
 * (daire, kare, squircle) kırpıyor ve zemin kenardan kenara dolu olmak
 * zorunda; `icon-512.png` ise köşeleri saydam yuvarlak bir kart. Aynı
 * dosyaya iki amaç birden verilseydi maskeleyen bir başlatıcıda köşeler
 * saydam kalırdı. `icon-maskable-512.png` o dosyanın zemini düzleştirilmiş
 * hâli — kelebek zaten güvenli alanın (%80'lik daire) içinde duruyor.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Butterfly Garden',

    /*
     * Ana ekrandaki etiket ~12 karakterden sonra kesiliyor; "Butterfly
     * Garden" oraya sığmıyor ve yarısı üç noktaya dönüyor.
     */
    short_name: 'Butterfly',

    description:
      'Release a butterfly into the meadow. It flies for seven days, then it goes.',
    start_url: '/',
    display: 'standalone',

    /*
     * İkisi de `--color-cream` (`app/styles/tokens.css`): açılış ekranının
     * zemini ve tarayıcı çubuğunun rengi sayfanın kendi zeminiyle aynı.
     * `layout.tsx` içindeki `viewport.themeColor` ile de aynı değer.
     */
    background_color: '#f7efe9',
    theme_color: '#f7efe9',

    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
