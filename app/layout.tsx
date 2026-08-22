import type { Metadata, Viewport } from 'next';
import { Newsreader, IBM_Plex_Sans } from 'next/font/google';
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

export const metadata: Metadata = {
  title: 'Butterfly Garden',
  description:
    'Release a butterfly into the meadow. It flies for seven days, then it goes.',
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
