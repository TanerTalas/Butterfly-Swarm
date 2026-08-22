import type { Metadata, Viewport } from 'next';
import { Newsreader, IBM_Plex_Sans } from 'next/font/google';
import { appUrl } from '@/lib/server/email';
import './globals.css';

/*
 * Yazı tipleri `next/font` ile kendi sunucumuzdan servis ediliyor.
 * fonts.gstatic.com'a giden engelleyici bir istek yok ve yazı yüklenirken
 * yerleşim kaymıyor — handoff'un açıkça istediği şey.
 *
 * Newsreader'ın değişken optik boyut ekseni (opsz 6..72) kullanımda: aynı
 * aile hem 76px başlıkta hem 20px form değerinde doğru duruyor.
 */
const newsreader = Newsreader({
  subsets: ['latin', 'latin-ext'],
  /*
   * `weight` BİLEREK yok. Newsreader değişken bir font; ağırlık zaten bir
   * eksen olarak geliyor ve 300–500 aralığının tamamı kullanılabiliyor.
   * `weight` listesi verilirse next/font sabit kesitler indirmeye çalışıyor
   * ve `axes` ile birlikte kullanılamıyor ("Axes can only be defined for
   * variable fonts when the weight property is nonexistent").
   */
  axes: ['opsz'],
  variable: '--font-newsreader',
  display: 'swap',
});

const plex = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-plex',
  display: 'swap',
});

/*
 * Sayfa künyesi ve paylaşım kartı.
 *
 * ⚠ SİMGELER VE PAYLAŞIM GÖRSELİ BURADA SAYILMIYOR. Next `app/` altındaki
 * şu dosya adlarını konvansiyon olarak tanıyıp etiketleri kendisi basıyor:
 * `favicon.ico`, `icon.svg`, `icon.png`, `apple-icon.png` ve
 * `opengraph-image.png`. Elle bir `icons` listesi yazmak, Next'in o
 * dosyalara eklediği içerik damgasını (`/icon.svg?a1b2c3`) kaybettirir —
 * damga, simge değiştiğinde tarayıcının eskisine yapışıp kalmasını önleyen
 * şey.
 *
 * ⚠ `metadataBase` ŞART: `og:image` MUTLAK bir adres olmak zorunda, paylaşım
 * kartını çeken robot göreli bir yolu çözemez. Adres `appUrl()`ten geliyor —
 * postadaki bağlantıların gövdesini veren fonksiyonun ta kendisi, çünkü soru
 * aynı: "bu site hangi adreste duruyor". İkinci bir kopya, alan adı
 * değiştiğinde birinin geride kalması demek.
 *
 * `openGraph` içinde başlık ve açıklama YOK ve bilerek yok: Next ikisini de
 * `title`/`description`tan devralıyor, yani yasal sayfaların kendi başlığı
 * (`Privacy · Butterfly Garden`) paylaşım kartına da geçiyor. Buraya sabit
 * bir başlık yazsaydık o sayfalar hep "Butterfly Garden" diye paylaşılırdı.
 */
export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: 'Butterfly Garden',
  description:
    'Release a butterfly into the meadow. It flies for seven days, then it goes.',
  openGraph: {
    type: 'website',
    siteName: 'Butterfly Garden',
    url: '/',
    locale: 'en_US',
  },
  /*
   * `twitter-image.png` diye İKİNCİ BİR DOSYA YOK ve gerekmiyor: Next
   * `twitter` alanının görselini, başlığını ve açıklamasını `openGraph`tan
   * devralıyor. Buradaki tek iş kartın büyük görselli biçimde açılmasını
   * istemek — varsayılanı küçük kare bir küçük resim.
   */
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: '#f7efe9',
  // Sahne tam ekran; telefonda çentik altına da uzansın
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /*
     * lang="en": arayüz metinlerinin tamamı İngilizce (handoff'ta kopya
     * "final" olarak işaretli). Türkçe verilirse CSS'in `text-transform:
     * uppercase` kuralı Türkçe kipe geçiyor ve noktalı büyük İ üretiyor —
     * "wing" etiketleri "WİNG" olarak çıkıyordu.
     */
    <html lang="en" className={`${newsreader.variable} ${plex.variable}`}>
      <body>{children}</body>
    </html>
  );
}
