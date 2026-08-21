'use client';

import { Button } from '@/components/ui/Button';
import type { ReleaseFailure } from '@/lib/types';

/*
 * D3-2 / D4 / D5 — salma butonuna BASILDIKTAN sonra reddedilmesi.
 *
 * Üç durum da tek parçada, çünkü ikisi iki karta birden giriyor: ağ hatası
 * hem misafir salmada hem kanat seçiminde olabiliyor ve iki ayrı çözüm iki
 * ayrı dil demek. Kartlar yalnızca `failure`ı geçiyor, ne yazacağına burası
 * karar veriyor.
 *
 * ── Kalıp yeni değil ──────────────────────────────────────────────────────
 *
 * "Kelebeklerim"deki dolu yuva hâlinin dili aynen sürüyor: birincil buton
 * devre dışı + etiketi değişiyor + ALTINDA nedenini söyleyen bir not. Yeni
 * bir uyarı kutusu icat edilmedi. Eklenen tek şey RENK: bu not bir durum
 * bildirimi değil, bir REDDİN karşılığı, ve reddin görünmesi gerekiyor —
 * yoksa "Letting it go…" durumundan geri dönen buton hiçbir şey olmamış gibi
 * duruyor.
 *
 * ── İki satır, iki iş ─────────────────────────────────────────────────────
 *
 *   birinci (danger)  ne olduğu
 *   ikinci  (faint)   ne KAYBEDİLMEDİĞİ
 *
 * İkincisi süs değil: üç durumda da kelebek salınmadı ama seçilen renkler ve
 * yazılan isim duruyor, ve kullanıcının bunu bilmeden ekranı terk etmesi
 * emeğini boşa harcamak demek.
 *
 * ── Ekran okuyucu ─────────────────────────────────────────────────────────
 *
 * `role="alert"`: red kullanıcının BASMASIYLA geliyor, yani beklenen bir an
 * ve kesintiye değer. Kart açılırken zaten engelli olan hâlde bu rol YOK
 * (`GuestReleaseCard`ın `blocked` notu sıradan bir metin) — orada kesilecek
 * bir akış yok.
 */
export function ReleaseNotice({
  failure,
  onGoToList,
}: {
  failure: ReleaseFailure;
  /** Yalnızca yuvalar dolduğunda: kullanıcıyı listeye götüren çıkış. */
  onGoToList?: () => void;
}) {
  const text = COPY[failure.kind];

  return (
    <div className="release-notice" role="alert">
      <p className="note note--center note--danger">{text.reason}</p>
      <p className="note note--center">{text.kept}</p>

      {/*
       * Listeye giden çıkış YALNIZCA `slots-full`da. Orada tavana çarpan
       * kullanıcının kendi listesi, dolayısıyla gidilecek anlamlı bir yer
       * var: bir yuva boşalınca oradan dönülecek.
       *
       * `meadow-full`da bu çıkış YANILTICI olurdu — listeye bakan kullanıcı
       * boş yuvalarını görüp "ama yerim var" der. Orada yapılacak tek şey
       * beklemek ve metin bunu söylüyor.
       */}
      {failure.kind === 'slots-full' && onGoToList && (
        <Button variant="secondary" size="sm" onClick={onGoToList}>
          See my butterflies
        </Button>
      )}
    </div>
  );
}

/*
 * Metin dili: notlar küçük harfle başlıyor, nokta yok, ünlem yok. Suçlayıcı
 * değil — olan biteni söyleyen bir ton.
 */
const COPY: Record<ReleaseFailure['kind'], { reason: string; kept: string }> = {
  'guest-limit': {
    /*
     * "from here", "from this network" DEĞİL. Sınır çerezle tutuluyor, yani
     * bu tarayıcıya ait — aynı ağdaki başka bir kişiyi ya da başka bir
     * cihazı engellemiyor. "Ağ" demek hem yanlış olurdu hem de sıradan bir
     * kullanıcıya hiçbir şey anlatmazdı.
     */
    reason: 'one has already gone from here today',
    kept: 'the limit is daily · signing in lifts it',
  },
  'slots-full': {
    reason: 'the fifth slot filled while you were choosing',
    kept: 'your colours and name are still here',
  },
  'meadow-full': {
    /*
     * Özne DEĞİŞİYOR ve bu bilinçli: `slots-full`ta tavana çarpan kullanıcı,
     * burada çayır. Kullanıcı kendi listesine bakıp yuvası olduğunu görecek,
     * dolayısıyla metin ona bir şey yapmadığını söylemeli.
     */
    reason: 'the meadow has no room right now',
    kept: 'your colours and name are still here · try again later',
  },
  network: {
    reason: 'that did not reach the meadow',
    kept: 'nothing was released · try again',
  },
};

/**
 * Reddedilen salmada birincil butonun etiketi ve kilidi.
 *
 * Kartlarda tekrarlanmasın diye burada: iki kart da aynı soruyu soruyor ve
 * aynı cevabı almalı. `null` dönerse buton kendi normal hâlinde kalıyor.
 *
 * Kural basit: KURAL İHLALİ kilitler, ARIZA kilitlemez. Ağ hatasında buton
 * yeniden basılabilir olmalı, yoksa tek çıkış sayfayı yenilemek olur ve
 * yenilemek taslağı riske atar.
 */
export function releaseLock(failure: ReleaseFailure | null | undefined): {
  label: string;
  disabled: true;
} | null {
  if (!failure) return null;
  if (failure.kind === 'guest-limit') {
    return { label: 'One a day', disabled: true };
  }
  /*
   * Etiket "Kelebeklerim"deki dolu hâlle AYNI kelime: orada da beş yuva
   * dolduğunda buton `Max out` diyor. İki ekranın aynı duruma iki farklı ad
   * vermesi, kullanıcıya iki farklı durum varmış gibi gelirdi.
   */
  if (failure.kind === 'slots-full') {
    return { label: 'Max out', disabled: true };
  }
  if (failure.kind === 'meadow-full') {
    return { label: 'Meadow is full', disabled: true };
  }
  return null;
}
