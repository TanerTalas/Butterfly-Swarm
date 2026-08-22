/*
 * Uygulama tipleri.
 *
 * Handoff'un "Data model (minimum)" bölümüyle hizalı. Sunucu gelene kadar
 * aynı şekiller `lib/mock.ts` içinde taklit ediliyor; Aşama C'de yalnızca
 * verinin KAYNAĞI değişecek, şekli değil.
 */

/** Kanat paleti — sahnedeki `WORLD.palette` ile birebir aynı olmalı. */
export const WING_COLOURS = [
  { name: 'turquoise', hex: '#17B3A3' },
  { name: 'blue', hex: '#2F5FD0' },
  { name: 'amber', hex: '#E8A01C' },
  { name: 'purple', hex: '#7A3FC4' },
  { name: 'green', hex: '#2F9E4F' },
] as const;

/*
 * Profil avatarı için beş seçenek.
 *
 * Handoff altı istiyordu; turkuaz (#17B3A3) çıkarıldı. İki sebep birden:
 * kanat paletindeki turkuazla BİREBİR aynı hex'ti, yani profil rozeti ile
 * kelebek rengi aynı şeymiş gibi okunuyordu — oysa ikisi ayrı seçim. Ve
 * yeşille yan yana durduğunda ayırt edilmesi zordu.
 *
 * ⚠ Kaldırılan renk `WING_COLOURS`ta DURUYOR; oradan silme, sahnedeki
 * `WORLD.palette` ile birebir eşleşmek zorunda (src/world/config.js).
 */
export const AVATAR_COLOURS = [
  { name: 'blue', hex: '#4F7FBF' },
  { name: 'pink', hex: '#D98AA6' },
  { name: 'amber', hex: '#E8A01C' },
  { name: 'purple', hex: '#7A6BC4' },
  { name: 'green', hex: '#6F8A5A' },
] as const;

/** Kelebek ismi üst sınırı — handoff'ta her sayaç `n/18`. */
export const NAME_MAX = 18;

/** Üyenin aynı anda taşıyabileceği canlı kelebek sayısı. */
export const SLOT_LIMIT = 5;

/*
 * Misafirin GÜNDE salabileceği kelebek sayısı.
 *
 * Üyedeki 5 sınırı "aynı anda kaç tane uçuyor" demek; buradaki ise bir hız
 * sınırı. Misafirin kelebeği takip edilemediği için biriktirmesinin anlamı
 * yok, ama sınırsız salma salma uç noktasını açık bir hedef hâline getiriyor.
 *
 * ⚠ Gerçek uygulama SUNUCUDA, IP başına. Buradaki sayı yalnızca arayüzün
 * doğru şeyi söylemesi için; istemcide tutulan bir sayaç tarayıcı
 * temizlenince sıfırlanır.
 */
export const GUEST_DAILY_LIMIT = 1;

/**
 * En kısa şifre.
 *
 * ⚠ Sunucuda da UYGULANMALI. Buradaki sayı yalnızca arayüzün aynı şeyi
 * söylemesi için: alan notu, hata rengi ve buton kilidi üçü de bunu okuyor.
 */
export const PASSWORD_MIN = 10;

/** Kelebeğin ömrü, gün. */
export const LIFESPAN_DAYS = 7;

export type Butterfly = {
  id: string;
  /** Misafir kelebeklerinde null. */
  name: string | null;
  foreHex: string;
  hindHex: string;
  releasedAt: Date;
  /**
   * Sahnenin görünüş çekilişlerini yaptığı tohum — SUNUCUDAN geliyor.
   *
   * ⚠ Yuvalar geri dönüşümlü olduğu için boy, çırpma hızı ve çayıra giriş
   * noktası yuvadan DEĞİL tohumdan türetiliyor; aynı kelebek yenilemeden
   * sonra da aynı görünmek zorunda (bkz. CLAUDE.md).
   *
   * Opsiyonel, çünkü sahne eksikse kimlikten türetiyor (`visitors.js` →
   * `hashSeed`) — o yol hâlâ geçerli bir yedek.
   */
  seed?: number;
};

export type Profile = {
  name: string;
  email: string;
  avatarHex: string;
};

/*
 * ── Reddedilen salma ──────────────────────────────────────────────────────
 *
 * Kullanıcı butona BASTIKTAN sonra salmanın olmaması. Kart açılırken zaten
 * engelli olma hâlinden ayrı bir şey: orada buton hiç basılmıyor, burada
 * basıldı ve bir şey olmadı.
 *
 * Üçü tek bir tip, çünkü ikisi iki ayrı kartta birden görünüyor
 * (`network` hem misafir salmada hem kanat seçiminde). Ayrı ayrı
 * tanımlansalardı iki kart aynı şeyi iki farklı dille söylerdi.
 *
 * ⚠ Bunlara SUNUCU karar veriyor. İstemci uygunluk hesaplamıyor; buradaki
 * tip yalnızca cevabın şekli. Bugün hiçbiri kendiliğinden oluşmuyor —
 * geliştirmede `window.__garden.failNext()` ile denenebiliyor
 * (`Garden.tsx`).
 */
export type ReleaseFailure =
  /**
   * Misafir günlük hakkı. Sınır bir ÇEREZDE tutuluyor, yani bu tarayıcıya
   * ait — aynı ağdaki başka bir kişiyi engellemiyor.
   */
  | { kind: 'guest-limit' }
  /** SENİN beş yuvan doldu (başka sekme, ya da istek sunucuda tavana takıldı). */
  | { kind: 'slots-full' }
  /**
   * ÇAYIRIN üye alanı doldu — senin yuvan boş olsa bile.
   *
   * `slots-full`tan bambaşka bir şey ve ayrı olması şart: orada tavana çarpan
   * kullanıcının kendisi, burada çayır. "Beş hakkını doldurdun" demek yanlış
   * olurdu ve kullanıcı bakıp iki kelebeği olduğunu görürdü.
   */
  | { kind: 'meadow-full' }
  /** İstek ulaşmadı ya da 5xx döndü. Kural ihlali yok: tekrar denenebilir. */
  | { kind: 'network' };

/*
 * ── Giriş hatası ──────────────────────────────────────────────────────────
 *
 * ⚠ `credentials` TEK bir mesaja karşılık geliyor: "email or password is
 * wrong". Hangi alanın yanlış olduğu SÖYLENMEZ — söylenirse e-postanın
 * kayıtlı olup olmadığı ele verilir ve kullanıcı sayımına izin verilmiş
 * olur. Bu bir tasarım tercihi değil, güvenlik kuralı.
 */
export type SignInError =
  | { kind: 'credentials' }
  /** Çok deneme. Sunucu ne kadar bekleneceğini söylüyorsa taşınıyor. */
  | { kind: 'rate-limit'; retryInSeconds?: number }
  | { kind: 'network' };

/*
 * Oturum — SUNUCUDAN gelen hâli.
 *
 * `app/page.tsx` bunu okuyup `Garden`a veriyor, yani sunucu/istemci sınırını
 * geçiyor: içinde yalnızca düz veri olmak zorunda.
 *
 * ⚠ `incomplete` ayrı bir hâl ve öyle kalmalı. Kayıt İKİ adım (önce e-posta +
 * şifre, sonra isim + renk); arada kalan kullanıcı giriş yapmış ama üye değil.
 * `member` gibi davranılsaydı isimsiz bir profille çayıra girer ve kelebeğinin
 * yanında boş bir isim görünürdü.
 */
export type Session =
  | { kind: 'guest' }
  | { kind: 'incomplete'; email: string }
  | { kind: 'member'; profile: Profile };

/**
 * Kalan gün — SUNUCU otoritesi olacak, bu yalnızca gösterim içindir.
 * İstemci uygunluk hesaplamıyor (handoff: "The client never computes
 * eligibility"); burada yalnızca ilerleme çubuğu çiziliyor.
 */
export function daysLeft(b: Butterfly, now = new Date()): number {
  const elapsed = (now.getTime() - b.releasedAt.getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(LIFESPAN_DAYS - elapsed));
}

/**
 * Kelebeğin yedi gününün dolduğu an.
 *
 * `daysLeft` gün sayıyor ve tavana yuvarlıyor — sayaç için doğru, çayırdaki
 * solma için değil: yuvarlanmış bir sayı kelebeği günde bir kez sıçratırdı.
 * Bu ise ham an, ve çayıra giden tek ömür bilgisi.
 *
 * ⚠ `LIFESPAN_DAYS`i okuyan TEK yer burasıyla `daysLeft`. Sahne motoru ömrün
 * kaç gün olduğunu bilmiyor, yalnızca iki mutlak an alıyor
 * (`src/world/visitors.js`) — kural değişince çayır kendiliğinden uyuyor.
 */
export function expiresAt(b: Butterfly): Date {
  return expiresFrom(b.releasedAt);
}

/**
 * Salma anından bitiş anı.
 *
 * `expiresAt` bir kelebek ister, sunucu ise kelebeği daha yeni kuruyor ve
 * elinde yalnızca an var. İkisi de burayı çağırıyor — `LIFESPAN_DAYS`i okuyan
 * TEK yer, ki kural değiştiğinde bir taraf eski süreyle kalmasın.
 */
export function expiresFrom(releasedAt: Date): Date {
  return new Date(releasedAt.getTime() + LIFESPAN_DAYS * 86_400_000);
}

export function formatReleased(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
