import { WORLD } from './config.js';
import { groundHeight } from './terrain.js';
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
 */

/**
 * @param {import('../swarm/Swarm.js').Swarm} swarm
 * @param {{residentCount?: number}} [options]
 */
export function createVisitors(swarm, options = {}) {
  const base = options.residentCount ?? WORLD.residentCount;

  /** id → instance indeksi. */
  const index = new Map();
  /** instance indeksi → id. Taşımada ters aramayı ucuzlatıyor. */
  const owner = new Map();

  /** Havuzda kaç ziyaretçi yeri var — yerleşiklerden sonrası. */
  const room = swarm.capacity - base;

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
   * @param {{id: string, foreHex: string|number, hindHex?: string|number}} b
   * @returns {number} instance indeksi, havuz doluysa -1
   */
  function release(b) {
    const existing = index.get(b.id);
    if (existing !== undefined) return existing;
    if (index.size >= room) return -1;

    const i = base + index.size;
    index.set(b.id, i);
    owner.set(i, b.id);

    setUserButterflyColors(
      swarm,
      i,
      toColorNumber(b.foreHex),
      toColorNumber(b.hindHex ?? b.foreHex),
    );
    enterFromEdge(swarm, i);
    swarm.setCount(base + index.size);

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
    swarm.setCount(base + index.size);
    return true;
  }

  /** Bütün ziyaretçileri kaldırır; yerleşikler kalıyor. */
  function clear() {
    index.clear();
    owner.clear();
    swarm.setCount(base);
  }

  /** Kelebeğin şu ANKİ instance indeksi — yoksa -1. Takip kipi bunu soruyor. */
  function at(id) {
    const i = index.get(id);
    return i === undefined ? -1 : i;
  }

  return { release, remove, clear, at, count, room };
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

  // Çırpma fazı yeniden çekiliyor: yan yana salınan iki kelebek aynı anda
  // kanat çırparsa ikiz gibi duruyorlar.
  swarm.phase[i] = rand();
  const attr = swarm.wingMesh?.geometry.getAttribute('aPhase');
  if (attr) attr.needsUpdate = true;
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
