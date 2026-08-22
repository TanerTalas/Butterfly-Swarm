import { WORLD } from './config.js';
import { groundHeight, mulberry32 } from './terrain.js';
import { SWARM_BOUNDS, setUserButterflyColors } from './swarm.js';

/*
 * Ziyaretçi kelebekleri — kullanıcının saldığı, sürünün geri kalanından
 * ayrılan tek grup.
 *
 * Çayırda iki nüfus var ve ikisi aynı `Swarm` içinde yaşıyor:
 *
 *   [0, residentCount)      yerleşikler — kimseye ait değil, hiç solmuyor,
 *                           rengi paletten deterministik geliyor
 *   [residentCount, count)  ziyaretçiler — bir kaydı var, rengini kullanıcı
 *                           seçti, yedi gün sonra gidecek
 *
 * ⚠ ZİYARETÇİLER BİTİŞİK DURMAK ZORUNDA. `Swarm.update()` yalnızca
 * `[0, count)` aralığını dönüyor ve `InstancedMesh.count` da aynı sayı;
 * aradaki bir boşluk "uçmayan ama çizilen" bir kelebek demek. Bu yüzden
 * ayrılan kelebeğin yuvası boş bırakılmıyor, sondaki kelebek oraya
 * taşınıyor (`Swarm.copyInstance`) ve sayı bir azalıyor.
 *
 * Kayıt defteri bu yüzden burada: taşıma indeksleri kaydırıyor ve
 * `butterfly.id → instanceIndex` eşlemesinin taşımadan sağ çıkması gerekiyor
 * — takip kipi (Aşama D) tamamen buna dayanıyor.
 *
 * ── Ziyaretçinin YUVADAN bağımsız olması ──────────────────────────────────
 *
 * Yuvalar geri dönüşümlü ve bir kelebek hangi yuvaya düşerse düşsün aynı
 * görünmek zorunda. `Swarm` çekilişleri kurulumda YUVA başına yapıyor —
 * boy, çırpma hızı, çırpma fazı, gezinme gürültüsü. Dokunulmasaydı aynı
 * kelebek yenilemeden sonra başka bir yuvaya düşüp başka boyda çıkardı.
 *
 * Bu yüzden salma anında çekilişler kelebeğin TOHUMUNDAN yeniden yapılıyor
 * (`Swarm.reseedInstance`). Tohum kimlikten türetiliyor, yani bugün sunucu
 * olmadan da deterministik; sunucu bir `seed` alanı göndermeye başladığında
 * yalnızca bu değer değişecek, mekanizma aynı kalacak.
 *
 * ── İki nüfus, tek blok ───────────────────────────────────────────────────
 *
 * Misafir ve üye kelebeklerinin ayrı tavanı var (`WORLD.guestSlots`,
 * `WORLD.memberSlots`) ama AYRI YERİ YOK: ikisi de aynı bitişik blokta
 * duruyor ve kontenjan yalnızca KABUL sırasında bakılıyor. Fiziksel olarak
 * ayrılsalardı aradaki boş yuvalar çizilirdi (yukarıdaki bitişiklik notu).
 *
 * ── Dolan misafir havuzu: YEM KELEBEK ─────────────────────────────────────
 *
 * Misafir kontenjanı dolduğunda salma REDDEDİLMİYOR, kelebek yalnızca
 * çayıra girmiyor. Sayaç artıyor, onay ekranı normal akıyor.
 *
 * Sebebi güvenlik: günlük hak bir çerezde tutuluyor ve çerez silinebilir.
 * Reddetmek, çerezi silerek kaç kelebek sığdırılabildiğini ÖLÇÜLEBİLİR
 * yapardı; sessiz kalmak o geri bildirimi kesiyor.
 *
 * Ama onay ekranındaki "Follow it in the meadow" boşa düşmemeli. Bu yüzden
 * düşürülen kimlik SABİT bir yerleşiğe eşleniyor: kullanıcı düğmeye
 * bastığında kamera gerçek bir kelebeğe gidiyor. Misafir kelebekleri
 * isimsiz ve paletten tek renk — yerleşikler de öyle, yani ayırt edilebilir
 * bir fark yok.
 *
 * ⚠ Yem YALNIZCA MİSAFİRE. Üyenin kelebeği isimli, listelenir ve takip
 * edilir; ona başka bir kelebeği göstermek fark edilebilir bir yalan olurdu.
 * Üye kontenjanı dolduğunda salma açıkça reddediliyor (`meadow-full`).
 */

/**
 * Yem kelebeğin instance indeksi — SABİT.
 *
 * Rastgele seçilseydi aynı kullanıcı iki kez baktığında başka bir kelebek
 * görürdü. Yerleşiklerin ilki: hiç solmuyor, hiç kalkmıyor, indeksi hiç
 * kaymıyor (taşıma yalnızca ziyaretçi bloğunda oluyor).
 */
const DECOY_INDEX = 0;

/**
 * @param {import('../swarm/Swarm.js').Swarm} swarm
 * @param {{residentCount?: number, guestSlots?: number, memberSlots?: number}} [options]
 */
export function createVisitors(swarm, options = {}) {
  const base = options.residentCount ?? WORLD.residentCount;
  const quota = {
    guest: options.guestSlots ?? WORLD.guestSlots,
    member: options.memberSlots ?? WORLD.memberSlots,
  };

  /** id → instance indeksi. */
  const index = new Map();
  /** instance indeksi → id. Taşımada ters aramayı ucuzlatıyor. */
  const owner = new Map();

  /**
   * id → `[başlangıç, bitiş]` (ms). Kalan ömür bu aralıktan her karede
   * türetiliyor; kaydı olmayan kelebek hiç solmuyor.
   *
   * ⚠ Motor "yedi gün"ü BİLMİYOR, iki mutlak an biliyor. Ömrün kaç gün
   * olduğu bir ürün kuralı ve tek yerde duruyor (`lib/types.ts`); burada
   * ikinci bir kopyası olsaydı kural değiştiğinde çayır sessizce eski
   * süreyle solmaya devam ederdi.
   */
  const life = new Map();

  /** id → 'guest' | 'member'. Kontenjan sayımı ve kaldırma buna bakıyor. */
  const kinds = new Map();
  /** Blokta o an kaç misafir / kaç üye kelebeği var. */
  const used = { guest: 0, member: 0 };

  /**
   * Kontenjanı dolduğu için çayıra GİRMEMİŞ misafir kimlikleri.
   *
   * Kayıt tutulması şart: `at()` bunlara yem kelebeğin indeksini dönüyor ve
   * köprü de kelebeği "uygulanmış" sayıp tekrar tekrar denemeyi bırakıyor.
   */
  const decoys = new Set();

  /** Havuzda kaç ziyaretçi yeri var — yerleşiklerden sonrası. */
  const room = swarm.capacity - base;

  /*
   * Kontenjanların toplamı bloğun kendisiyle eşleşmeli. Eşleşmezse ya yer
   * boşa gidiyor ya da bir kontenjan hiç dolamıyor — ikisi de sessizce
   * yanlış davranır, o yüzden kurulumda söyleniyor.
   */
  if (quota.guest + quota.member !== room) {
    console.warn(
      `[visitors] kontenjan toplamı bloğa uymuyor: ` +
        `${quota.guest} + ${quota.member} ≠ ${room} ` +
        `(capacity ${swarm.capacity} − resident ${base})`,
    );
  }

  /** Çayırda GERÇEKTEN uçan ziyaretçi sayısı — yemler sayılmıyor. */
  function count() {
    return index.size;
  }

  /**
   * Bir kelebeği çayıra salar.
   *
   * Aynı `id` ikinci kez gelirse yeni yuva AÇILMIYOR: var olan yuvanın
   * indeksi dönüyor. Salma isteği tekrar edilebilir olmalı (ağ hatası,
   * çift tıklama, sunucudan gelen listenin yeniden uygulanması) ve her
   * denemede bir kelebek daha belirmemeli.
   *
   * @param {{
   *   id: string,
   *   foreHex: string|number,
   *   hindHex?: string|number,
   *   seed?: number,
   *   kind?: 'guest'|'member',
   *   releasedAt?: Date|number,
   *   expiresAt?: Date|number,
   * }} b
   * @returns {number} instance indeksi; üye kontenjanı doluysa -1.
   *   Misafir kontenjanı dolduğunda -1 DÖNMÜYOR: yem kelebeğin indeksi
   *   dönüyor ve kelebek çayıra hiç girmiyor (bkz. dosya başı).
   */
  function release(b) {
    const existing = index.get(b.id);
    if (existing !== undefined) return existing;
    if (decoys.has(b.id)) return DECOY_INDEX;

    const kind = b.kind === 'member' ? 'member' : 'guest';

    if (used[kind] >= quota[kind] || index.size >= room) {
      /*
       * Misafir sessizce yem kelebeğe düşüyor; üye açıkça reddediliyor ve
       * reddi ARAYÜZ gösteriyor (`meadow-full`). Farkın sebebi dosya
       * başındaki notta.
       */
      if (kind === 'guest') {
        decoys.add(b.id);
        return DECOY_INDEX;
      }
      return -1;
    }

    const i = base + index.size;
    index.set(b.id, i);
    owner.set(i, b.id);
    kinds.set(b.id, kind);
    used[kind] += 1;

    /*
     * Tek üreteç, iki iş: kelebeğin çekilişleri ve çayıra giriş noktası.
     * İkisi de aynı tohumdan geldiği için kelebek her salındığında aynı
     * boyda, aynı hızda ve çayırın aynı kenarından giriyor.
     */
    const rand = mulberry32(b.seed ?? hashSeed(b.id));
    swarm.reseedInstance(i, rand);

    setUserButterflyColors(
      swarm,
      i,
      toColorNumber(b.foreHex),
      toColorNumber(b.hindHex ?? b.foreHex),
    );
    enterFromEdge(swarm, i, rand);

    /*
     * Solma yalnızca İKİ uç da verildiğinde başlıyor. Biri eksikse oran
     * hesaplanamaz ve yarım bir varsayım ("herhalde yedi gündür") kuralı
     * motora sızdırırdı; eksikse kelebek hiç solmuyor.
     */
    const from = b.releasedAt == null ? null : toMillis(b.releasedAt);
    const to = b.expiresAt == null ? null : toMillis(b.expiresAt);
    if (from !== null && to !== null && to > from) life.set(b.id, [from, to]);
    else life.delete(b.id);
    swarm.setFade(i, 1);

    swarm.setCount(base + index.size);
    swarm.fadeNeedsUpdate();

    return i;
  }

  /**
   * Kelebeği çayırdan kaldırır: ömrü doldu, hesap silindi, oturum kapandı.
   *
   * Sondaki kelebek boşalan yuvaya taşınıyor ve onun kaydı yeni indeksine
   * güncelleniyor — dışarıdaki hiç kimse eski indeksi saklamamalı, `at()`
   * her seferinde sorulmalı.
   */
  function remove(id) {
    // Yem hiç çayıra girmemişti; kaldırılacak bir yuva yok.
    if (decoys.delete(id)) return true;

    const i = index.get(id);
    if (i === undefined) return false;

    const last = base + index.size - 1;
    if (i !== last) {
      swarm.copyInstance(last, i);
      const moved = owner.get(last);
      if (moved !== undefined) {
        index.set(moved, i);
        owner.set(i, moved);
      }
    }

    // Son yuva her iki durumda da boşalıyor: ya taşınan kelebek oradan
    // ayrıldı ya da kaldırılan kelebek zaten oradaydı.
    owner.delete(last);
    index.delete(id);
    life.delete(id);

    const kind = kinds.get(id);
    if (kind) used[kind] -= 1;
    kinds.delete(id);

    /*
     * Boşalan yuva 1'e dönüyor. `copyInstance` ömrü de taşıyor, yani sondaki
     * kelebek kendi ömrüyle geliyor; sıfırlanan yalnızca ARTIK KİMSENİN
     * OLMAYAN son yuva. Bırakılsaydı oraya düşecek bir sonraki kelebek yarı
     * solmuş doğardı.
     */
    swarm.setFade(base + index.size, 1);
    swarm.setCount(base + index.size);
    swarm.fadeNeedsUpdate();
    return true;
  }

  /** Bütün ziyaretçileri kaldırır; yerleşikler kalıyor. */
  function clear() {
    for (const i of owner.keys()) swarm.setFade(i, 1);
    index.clear();
    owner.clear();
    life.clear();
    kinds.clear();
    decoys.clear();
    used.guest = 0;
    used.member = 0;
    swarm.setCount(base);
    swarm.fadeNeedsUpdate();
  }

  /**
   * Kalan ömürleri tazeler — sahne döngüsünden her karede çağrılıyor.
   *
   * Ömür SAATTEN türetiliyor, sayaçla azaltılmıyor: sekme arka planda
   * kaldığında ya da cihaz uyuduğunda kare akmıyor, azaltılan bir sayaç
   * orada donup kelebeği olduğundan genç gösterirdi.
   *
   * Ucuz: ziyaretçi sayısı en çok birkaç düzine ve yapılan iş bir çıkarma.
   * Yerleşiklere hiç dokunulmuyor.
   */
  function update(now = Date.now()) {
    if (life.size === 0) return;

    for (const [id, [from, to]] of life) {
      const i = index.get(id);
      if (i === undefined) continue;
      swarm.setFade(i, (to - now) / (to - from));
    }
    swarm.fadeNeedsUpdate();
  }

  /**
   * Kelebeğin şu ANKİ instance indeksi — yoksa -1. Takip kipi bunu soruyor.
   *
   * Çayıra girememiş bir MİSAFİR kelebeği için yem kelebeğin indeksi
   * dönüyor: onay ekranındaki "Follow it in the meadow" boşa düşmesin diye.
   */
  function at(id) {
    const i = index.get(id);
    if (i !== undefined) return i;
    return decoys.has(id) ? DECOY_INDEX : -1;
  }

  return {
    release,
    remove,
    clear,
    update,
    at,
    count,
    room,
    /** Teşhis: kontenjanların ne kadarı dolu, kaç kelebek yeme düştü. */
    stats: () => ({ ...used, quota: { ...quota }, decoys: decoys.size }),
  };
}

/*
 * Kelebek çayırın KENARINDAN giriyor, ortada yoktan belirmiyor.
 *
 * Salma anının bir yeri olmalı: kullanıcı "let it go" dedikten sonra
 * çayıra döndüğünde kelebeğinin içeri süzüldüğünü görüyor. Doğrudan
 * merkeze konsaydı sahnede bir kare içinde yeni bir nokta beliriyor ve
 * salma hissi kayboluyordu.
 *
 * Yükseklik uçuş hacminin ALT yarısında: kelebek aşağıdan girip yükseliyor,
 * yani gökten inmiyor.
 */
function enterFromEdge(swarm, i, rand = Math.random) {
  const b = SWARM_BOUNDS;
  const angle = rand() * Math.PI * 2;
  const r = b.radius * 0.96;
  const x = Math.cos(angle) * r;
  const z = Math.sin(angle) * r;

  swarm.position[i * 3] = x;
  swarm.position[i * 3 + 1] =
    groundHeight(x, z) + b.minY + rand() * (b.maxY - b.minY) * 0.4;
  swarm.position[i * 3 + 2] = z;

  // İçeri doğru, hafif yukarı. Sınır kuvveti zaten kenarda içeri itiyor;
  // bu hız yalnızca ilk saniyenin yönünü veriyor.
  const speed = 0.9;
  swarm.velocity[i * 3] = -Math.cos(angle) * speed;
  swarm.velocity[i * 3 + 1] = 0.12;
  swarm.velocity[i * 3 + 2] = -Math.sin(angle) * speed;

  // Çırpma fazı burada DEĞİL: `reseedInstance` onu kelebeğin tohumundan
  // çekiyor ve o çağrı bundan hemen önce yapılıyor. İki yerden yazılsaydı
  // fazı hangisinin belirlediği belirsiz olurdu.
}

/**
 * Kimlikten deterministik 32 bit tohum — FNV-1a.
 *
 * Kelebeğin kendi `seed`'i gelene kadar tohum kimlikten türetiliyor.
 * Kriptografik olması gerekmiyor; istenen tek şey aynı kimliğin her zaman
 * aynı sayıyı vermesi ve bitişik kimliklerin (`seed-mint`, `seed-olive`)
 * bitişik tohumlara düşmemesi.
 */
function hashSeed(id) {
  let h = 0x811c9dc5;
  for (let k = 0; k < id.length; k++) {
    h ^= id.charCodeAt(k);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** `Date` ya da ms — motor sayı ile çalışıyor, sınırda çevriliyor. */
function toMillis(value) {
  return typeof value === 'number' ? value : value.getTime();
}

/**
 * `'#17B3A3'` → `0x17b3a3`. Sayı verilmişse olduğu gibi geçiyor.
 *
 * Arayüz renkleri metin olarak taşıyor (`lib/types.ts`), motor sayı
 * bekliyor (`wingTintFromColor` baytları kaydırarak okuyor). Dönüşüm tam
 * burada, sınırda yapılıyor — iki taraf da kendi biçimini koruyor.
 */
function toColorNumber(value) {
  if (typeof value === 'number') return value;
  return parseInt(String(value).replace('#', ''), 16) || 0;
}
