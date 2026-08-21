import Link from 'next/link';
import type { ReactNode } from 'react';
import { Close } from '@/components/ui/Icons';

/*
 * Çayır ekranlarının ortak kabuğu.
 *
 * Canlı sahne, metnin okunması için açılan bir perde, kenar boşluğu, sağ
 * üstte hesap rozeti + sayaç + çayır denetimi, en altta yasal bağlantılar.
 *
 * Görünüşün tamamı `app/styles/shell.css` içinde. Burada yalnızca hangi
 * parçanın ne zaman çizildiği var.
 *
 * ⚠ KAYDIRMA KABUĞUN TAMAMI. Eskiden yalnızca orta bölme kayıyordu ve
 * ekrana sığmayan kartlar ekranın ortasında bir yerde kesiliyordu; sebebi
 * ve ölçümü shell.css'te yazılı. Buradaki karşılığı: `meadow-shell-scroll`
 * ekranı kaplıyor, `meadow-shell-layout` ise `min-height: 100%` ile
 * içeriğinden büyüyebiliyor.
 */

const LEGAL = [
  { href: '/legal/privacy', label: 'privacy' },
  { href: '/legal/terms', label: 'terms' },
  { href: '/legal/cookies', label: 'cookies' },
  { href: '/legal/contact', label: 'contact' },
];

export function MeadowShell({
  children,
  notice,
  scrim = 'default',
  counter,
  topRight,
  aside,
  legal = false,
  hidden,
}: {
  children: ReactNode;
  /**
   * Sahneyle ilgili bildirim şeridi — en üstte, yatayda ortalı.
   *
   * Akışın İÇİNDE, mutlak konumlu değil: köşeye yapıştırılmış hâli 390px'te
   * sayacın üstüne biniyordu. Burada duran her şey aynı sütunda sıraya
   * giriyor, dolayısıyla çakışma geometrik olarak mümkün değil.
   */
  notice?: ReactNode;
  scrim?: 'default' | 'heavy';
  counter?: ReactNode;
  topRight?: ReactNode;
  /** Çayır denetimi ("Watch the meadow"). */
  aside?: ReactNode;
  /**
   * Yasal bağlantı şeridi.
   *
   * Yalnızca çayır görünümlerinde (karşılama ve girişli çayır) açılıyor.
   * Kart ekranlarında kapalı: şerit kartla aynı sütunda duruyor ve ekrana
   * sığmayan bir kartı yukarı itip kesilmesine yol açıyordu. Yasal sayfalara
   * oradan da ulaşılabiliyor — giriş kartının altındaki "terms" bağlantısı
   * ve /legal sayfalarının kendi menüsü duruyor.
   */
  legal?: boolean;
  /** İzleme kipi: kabuk tamamen çekiliyor, sahne yalnız kalıyor. */
  hidden?: boolean;
}) {
  /*
   * İzleme kipinde kabuk unmount EDİLMİYOR, görünmez yapılıyor: kartların
   * durumu (yazılmış isim, seçilmiş renkler) korunuyor ve geri dönüldüğünde
   * kullanıcı kaldığı yerden devam ediyor.
   */
  return (
    <div
      className={`meadow-shell ${hidden ? 'meadow-shell--hidden' : ''}`}
      data-scrim={scrim}
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
      <div className="meadow-scrim meadow-scrim--side" aria-hidden />
      <div className="meadow-scrim meadow-scrim--bottom" aria-hidden />

      <div className="meadow-shell-scroll scrollbar-none">
        <div className="meadow-shell-layout">
          {notice && <div className="meadow-notice-row">{notice}</div>}

          {/*
           * Üst şerit. Hesap rozeti, sayaç ve çayır denetimi tek bir dikey
           * yığın.
           *
           * Denetim MASAÜSTÜNDE bu yığından çıkıp sağ kenara sabitleniyor
           * (CSS'te `position: absolute`). Mobilde ise yığında kalıyor,
           * yani sayaçla asıl arayüzün arasında — kenarda sabitken
           * karşılama başlığının üstüne biniyordu.
           */}
          <div className="meadow-shell-top">
            <div className="meadow-shell-top-stack">
              {topRight}
              {counter}
              {aside}
            </div>
          </div>

          <div className="meadow-shell-body">{children}</div>

          {legal && (
            <div className="legal-bar-row">
              <nav className="legal-bar">
                {LEGAL.map((l) => (
                  <Link key={l.href} href={l.href} className="legal-bar-link">
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}
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
 */
export function ReleaseCounter({ total }: { total: number }) {
  return (
    <div className="release-counter">
      <div className="release-counter-label">released into the meadow</div>
      <div className="release-counter-value">{total.toLocaleString('en-US')}</div>
      {/* Sayının ne olduğunu söyleyen alt satır — yeni tasarımda eklendi */}
      <div className="release-counter-unit">butterflies</div>
    </div>
  );
}

/**
 * Sahne çizilemediğinde görünen bildirim (D8).
 *
 * ── Neden bir hata değil ──────────────────────────────────────────────────
 *
 * Ton bilerek sakin ve uyarı rengi YOK: ortada kullanıcının düzeltebileceği
 * bir hata yok, düşülen bir kalite seviyesi var. Salma, hesap, liste —
 * hepsi çalışmaya devam ediyor ve ikinci satır tam olarak bunu söylüyor.
 * Kenarlığı krem zeminden bir tık koyu, çünkü altındaki görselde hem açık
 * gökyüzü hem koyu gövde var ve şeridin kendi sınırı belli olmalı.
 *
 * ── Neden kapatılabilir ───────────────────────────────────────────────────
 *
 * Bilgi bir kez okunuyor; bundan sonrası gürültü. Kapatma sekme ömrü boyunca
 * hatırlanıyor (`sessionStorage`), kalıcı değil: WebGL her açılışta yok
 * olacak ve şeridi sonsuza dek gizlemek, aylar sonra dönen kullanıcıyı
 * hareketsiz bir çayırla açıklamasız bırakırdı.
 *
 * `role="status"` — `alert` DEĞİL. `alert` ekran okuyucunun o an okuduğu şeyi
 * kesiyor; bu bildirim sayfa açılırken beliriyor ve kesilecek bir şey yok,
 * üstelik acil de değil.
 */
export function SceneNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="scene-notice" role="status">
      <div className="scene-notice-copy">
        <p className="note note--strong">
          the meadow cannot be drawn in this browser
        </p>
        <p className="note">everything else still works</p>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="dismiss this notice"
        className="scene-notice-close"
      >
        <Close />
      </button>
    </div>
  );
}
