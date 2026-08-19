import Link from 'next/link';
import type { ReactNode } from 'react';

/*
 * Çayır ekranlarının ortak kabuğu.
 *
 * Canlı sahne, metnin okunması için soldan sağa açılan bir perde, 72px kenar
 * boşluğu, sağ üstte hesap rozeti ve sayaç, sağ altta yasal bağlantılar.
 *
 * Perde bir "karartma" değil, YÖNLÜ bir geçiş: solda krem neredeyse opak,
 * sağda tamamen şeffaf. Kartlar okunurken çayır da görünür kalıyor.
 */

const LEGAL = [
  { href: '/legal/privacy', label: 'privacy' },
  { href: '/legal/terms', label: 'terms' },
  { href: '/legal/cookies', label: 'cookies' },
  { href: '/legal/contact', label: 'contact' },
];

export function MeadowShell({
  children,
  scrim = 'default',
  counter,
  topRight,
  aside,
  hidden,
}: {
  children: ReactNode;
  scrim?: 'default' | 'heavy';
  counter?: ReactNode;
  topRight?: ReactNode;
  /** Sahnenin sag kenarinda duran denetim ("Watch the meadow"). */
  aside?: ReactNode;
  /** Izleme kipi: kabuk tamamen cekiliyor, sahne yalniz kaliyor. */
  hidden?: boolean;
}) {
  const gradient =
    scrim === 'heavy'
      ? 'linear-gradient(90deg, rgba(247,239,233,0.96) 0%, rgba(247,239,233,0.80) 34%, rgba(247,239,233,0) 62%)'
      : 'linear-gradient(90deg, rgba(247,239,233,0.94) 0%, rgba(247,239,233,0.74) 34%, rgba(247,239,233,0) 60%)';

  /*
   * Izleme kipinde kabuk unmount EDILMIYOR, gorunmez yapiliyor: kartlarin
   * durumu (yazilmis isim, secilmis renkler) korunuyor ve geri donuldugunde
   * kullanici kaldigi yerden devam ediyor.
   */
  return (
    <div
      className={`transition-opacity duration-500 ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      /*
       * `inert` şart: yalnızca opaklığı sıfırlamak arayüzü GÖRÜNMEZ yapıyor
       * ama yok etmiyor. Sekme tuşuyla gezen biri izleme kipindeyken
       * görünmeyen butonların içinde dolaşıyor, ekran okuyucu da onları
       * okumaya devam ediyordu. `inert` alt ağacı odaktan ve erişilebilirlik
       * ağacından çıkarıyor; `display: none` ise geçiş animasyonunu
       * öldürürdü.
       */
      inert={hidden}
      aria-hidden={hidden}
    >
      {aside}

      <div
        className="pointer-events-none absolute inset-0 max-lg:hidden"
        style={{ background: gradient }}
        aria-hidden
      />
      {/*
       * Mobilde perde YÖNÜ değişiyor: içerik altta toplandığı için geçiş
       * soldan sağa değil, yukarıdan aşağıya.
       */}
      <div
        className="pointer-events-none absolute inset-0 lg:hidden"
        style={{
          background:
            'linear-gradient(180deg, rgba(247,239,233,0) 0%, rgba(247,239,233,0.55) 42%, rgba(247,239,233,0.95) 72%)',
        }}
        aria-hidden
      />

      <div className="absolute inset-0 flex flex-col p-6 lg:p-[72px]">
        {/*
         * Üst şerit. Hesap rozeti ÜSTTE, sayaç onun ALTINDA — dikey bir
         * yığın. (Yatay dizilim denendi ve rozet sayacın sağında kalıyordu;
         * sahibinin son kararı bu.)
         */}
        <div className="flex items-start justify-end">
          <div className="flex flex-col items-end gap-3">
            {topRight}
            {counter}
          </div>
        </div>

        {/*
         * Kaydırılabilir içerik alanı.
         *
         * `overflow-y-auto` şart: kanat seçimi ve hesap kurulumu kartları
         * kısa bir pencerede ekrandan taşıyor ve birincil buton görünmez
         * oluyordu.
         *
         * ⚠ Ama bu kap AYNI ZAMANDA bir kırpma kutusu. CSS'te yalnızca bir
         * eksende `visible` olamıyor: `overflow-y: auto` verince tarayıcı
         * `overflow-x`i de `auto` yapıyor. Sonuç: kartın kendi gölgesi
         * (aşağı 58px uzanıyor) ve birincil butonun hover'daki kanat
         * gölgeleri (±22px) kutunun kenarında KESİLİYORDU.
         *
         * Çözüm dolgu + negatif kenar boşluğu: kap gölgelerin sığacağı
         * kadar içeriden dolgulanıyor, negatif margin ile yerleşimde
         * hiçbir şey kaymıyor. Kırpma sınırı gölgelerin dışına itilmiş
         * oluyor.
         */}
        <div className="scrollbar-none -mx-5 -my-6 flex flex-1 items-end overflow-y-auto px-5 py-6 lg:-mx-12 lg:-my-10 lg:px-12 lg:py-10 lg:items-center">
          <div className="w-full">{children}</div>
        </div>

        <div className="flex justify-center pt-4 lg:justify-end">
          {/*
           * Yasal bağlantılar KENDİ zeminini taşıyor.
           *
           * Önceden çıplak metindi ve çayırın üstünde okunmuyordu: sahne
           * canlı, kamera döndükçe arkalarına açık çimen de koyu gövde de
           * geliyor. Metin gölgesi yetmedi. Çözüm bağlantıları krem bir
           * hapa almak — sahnenin üstünde küçük ama kesin bir okunabilirlik
           * adası, perdeyi büyütmeye gerek kalmıyor.
           */}
          <nav
            /*
             * Boşluk 2px, çünkü bağlantıların KENDİ dolgusu var (px-2).
             * Dolgu, hover'daki arka plan lekesinin metne yapışmaması için
             * gerekli; ikisi toplanınca metinler arası mesafe tasarımdaki
             * 18px'e denk geliyor. Dolgu hover'da eklenseydi yerleşim
             * oynardı.
             */
            className="flex gap-[2px] rounded-full px-3 py-1.5"
            style={{
              background: 'rgba(253,246,242,0.86)',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 4px 14px rgba(74,59,56,0.12)',
            }}
          >
            {LEGAL.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                /*
                 * Renk tasarımın kendi bağlantı kuralından geliyor: vurgu
                 * rengi, hover'da koyulaşıyor ve altı çiziliyor. Önceden
                 * soluk griydiler ve tıklanabilir görünmüyorlardı.
                 *
                 * Üstüne yumuşak bir zemin lekesi: sahne canlı olduğu için
                 * yalnızca renk değişimi bazı karelerde fark edilmiyor.
                 */
                className="rounded-full px-2 py-1 font-mono text-[11px] tracking-[0.14em] text-accent underline-offset-4 transition-colors duration-200 hover:bg-[rgba(160,79,99,0.12)] hover:text-[#7D3A4C] hover:underline"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}

/**
 * Küresel salım sayacı.
 *
 * Yalnızca ana çayır görünümlerinde çiziliyor (karşılama ve girişli çayır),
 * kart ekranlarında değil — sahibinin isteği. Bir kartın yanında duran sayaç
 * o kartın parçası gibi okunuyordu.
 *
 * Kendi zeminini taşıyor, tıpkı yasal bağlantılar gibi ve aynı sebeple.
 */
export function ReleaseCounter({ total }: { total: number }) {
  return (
    <div
      className="rounded-[14px] px-4 py-3 text-right"
      style={{
        background: 'rgba(253,246,242,0.88)',
        backdropFilter: 'blur(6px)',
        boxShadow: '0 6px 18px rgba(74,59,56,0.16)',
      }}
    >
      <div className="font-mono text-[11px] leading-none tracking-[0.16em] text-muted uppercase">
        released into the meadow
      </div>
      <div className="mt-2 font-display text-[34px] leading-none text-ink">
        {total.toLocaleString('en-US')}
      </div>
      {/* Sayının ne olduğunu söyleyen alt satır — yeni tasarımda eklendi */}
      <div className="mt-1 font-mono text-[11px] leading-none tracking-[0.14em] text-faint">
        butterflies
      </div>
    </div>
  );
}
