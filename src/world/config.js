/*
 * Dünyanın tek doğruluk kaynağı.
 *
 * ── Mekânın kurgusu ────────────────────────────────────────────────────────
 *
 * Dünya bilinçli olarak KÜÇÜK ve KAPALI. İç içe üç halka:
 *
 *      0 ─────── 12        DÜZ uçuş alanı. Kelebekler burada. Ağaç yok.
 *     14 ─────── 21        Sakura halkası. Alanı çevreliyor, içine girmiyor.
 *     26 ─────── 42        Dağ duvarı. Yüksek ve yakın; ötesi görünmüyor.
 *
 * Tepe yok, iniş çıkış yok: zemin düz, dağlar dik. Aradaki her şey ya çim
 * ya ağaç. Dağların ötesinde hiçbir şey modellenmiyor, çünkü görünmüyor.
 *
 * Bu ölçek `meadowRadius` üzerinden türetilmiyor — her halka kendi sayısını
 * taşıyor ki biri değişince diğerleri kaymasın.
 */

export const WORLD = {
  // ── Ölçek ────────────────────────────────────────────────────────────────
  /*
   * Kelebeklerin uçtuğu düz alan. Bir kelebek ~0.5 birim, yani 12 birimlik
   * yarıçap ~50 kelebeğin rahatça dolaştığı bir avlu demek.
   */
  meadowRadius: 12,

  /*
   * Zemin diski. Dağların arkasında kalıyor, o yüzden büyük olmasına gerek
   * yok — 60 birim yalnızca dağ eteklerinin oturacağı zemini veriyor.
   */
  groundRadius: 130,

  // ── Nüfus ────────────────────────────────────────────────────────────────
  // Kimseye ait olmayan, hiç solmayan kelebekler (bkz. projefikri.md §4).
  residentCount: 60,

  /*
   * ZİYARETÇİ KONTENJANLARI — misafir ve üye kelebekleri için ayrı tavan.
   *
   * ⚠ Bunlar ADRES ARALIĞI DEĞİL, KONTENJAN. Kelebekler tek bir bitişik
   * blokta duruyor (`[residentCount, count)`) ve öyle durmak zorunda:
   * `Swarm.update()` yalnızca `[0, count)` aralığını dönüyor ve
   * `InstancedMesh.count` da aynı sayı. İki ayrı fiziksel bölge açılsaydı
   * aradaki boş yuvalar "uçmayan ama çizilen" kelebekler olurdu.
   *
   * Bölünen şey KABUL: blokta kaç misafir, kaç üye kelebeği olabileceği.
   *
   * Toplamları `capacity - residentCount` ile birebir eşleşmeli; eşleşmezse
   * `createVisitors` kurulumda uyarıyor.
   */
  guestSlots: 20,
  memberSlots: 120,

  /*
   * KELEBEK PALETİ — 5 sabit renk (projefikri.md §4).
   *
   * Yerleşik ve misafir kelebekler bu paletten RASTGELE bir renk alıyor ve
   * tek renk geziyorlar. Kayıtlı kullanıcılar ya bu paletten seçiyor ya da
   * ön/arka kanada ayrı renk veriyor.
   *
   * Hiçbiri pembe/magenta DEĞİL, bilinçli: sahne baştan aşağı sakura pembesi
   * ve pembe kelebek zeminde kayboluyor (§4 — sakura tuzağı). Hepsi doygun,
   * çünkü uzaktan bakılan küçük bir nesnede rengin okunması için doygunluk
   * gerekiyor — soluk kelebek çimenle karışıyor.
   *
   * (Teknik bir zorunluluk DEĞİL artık: renk artık ton + doygunluk +
   * parlaklık olarak taşınıyor, yani soluk ve koyu renkler de doğru
   * çalışıyor. Buradaki tercih görünürlükle ilgili.)
   */
  palette: [
    { name: 'turkuaz', hex: 0x17b3a3 },
    { name: 'derin mavi', hex: 0x2f5fd0 },
    { name: 'kehribar', hex: 0xe8a01c },
    { name: 'mor', hex: 0x7a3fc4 },
    { name: 'zümrüt', hex: 0x2f9e4f },
  ],

  // ── Güneş ────────────────────────────────────────────────────────────────
  // Alçak ve sıcak: sakura arkadan aydınlandığında güzel duruyor.
  sun: {
    elevation: 9.0, // derece, ufuktan yukarı
    azimuth: 168, // derece
  },

  sky: {
    turbidity: 6.0,
    rayleigh: 2.6,
    mieCoefficient: 0.006,
    mieDirectionalG: 0.86,
  },

  // ── Sis ──────────────────────────────────────────────────────────────────
  /*
   * Dünya küçüldüğü için sis de zayıfladı. Dağlar artık 34 birimde;
   * eski yoğunlukta (0.0038) neredeyse hiç etkilenmiyorlardı, daha da
   * yükseltilirse avlunun kendisi puslanıyor. Bu değer dağ eteklerini
   * hafifçe yumuşatıp tepelerini net bırakıyor.
   */
  /*
   * Sis yoğunluğu üç mesafe arasında denge kuruyor:
   *
   *   30 birim (en uzak ağaç)   → ~%18 sis, ağaçlar gözle görülür şekilde soluk
   *   46 birim (iç dağ halkası) → ~%39 sis, atmosferik derinlik
   *   82 birim (dış dağ halkası)→ ~%78 sis, soluk silüet ama hâlâ orada
   *
   * 0.0075'te hiçbir şey sislenmiyordu; 0.02'de dış dağ halkası neredeyse
   * tamamen siliniyordu. Bu değer ikisinin arasında duruyor.
   */
  fog: {
    color: 0xe9d3c9,
    density: 0.015,
  },

  // ── Sakura halkası ───────────────────────────────────────────────────────
  /*
   * Ağaçlar uçuş alanının DIŞINDA duruyor. İçeri girerlerse hem kelebeklerin
   * alanını bölüyorlar hem de kamera sürekli dal arkasında kalıyor.
   *
   * Sayı yüksek: halka ancak dolduğunda "koru" hissi veriyor, 4 ağaç
   * dağınık duruyordu.
   */
  trees: {
    /*
     * Ağaçlar InstancedMesh olarak çiziliyor (bkz. trees.js), yani bu sayı
     * draw call'u ETKİLEMİYOR — yalnızca üçgen sayısını. Ağaç başına
     * ~3.000–7.000 üçgen.
     */
    count: 84,
    /*
     * Halka açı × yarıçap ızgarasına bölünüyor; `rows` yarıçap bandı
     * sayısı, açı dilimi sayısı `count / rows` oluyor. Bu, halkada boşluk
     * kalmasını engelliyor (bkz. trees.js — katmanlı örnekleme).
     */
    rows: 4,
    /*
     * Bu yarıçapın İÇİNDEKİ ağaçlar detaylı model kullanıyor ve gölge
     * düşürüyor; dışındakiler ucuz modele düşüp gölge düşürmüyor
     * (bkz. trees.js — LOD). Değeri büyütmek kaliteyi, küçültmek fps'i
     * artırıyor.
     */
    /*
     * 20'den 15'e indi. Bu yarıçapın içindeki ağaçlar hem pahalı modeli
     * kullanıyor hem GÖLGE düşürüyor, yani iki kez çiziliyorlar. Ölçümde
     * ağaçlar bütün sahnenin %52'siydi (498.667 üçgen) ve bunun yarısı
     * gölge geçişiydi. 15'te gölge düşüren ağaç sayısı belirgin azalıyor,
     * kaybedilen şey ise avlunun dışındaki gölgeler — kimsenin bakmadığı yer.
     */
    lodRadius: 15,

    /*
     * Kadrajı çerçeveleyen ağaçlar. Kameranın başlangıç noktasının hemen
     * önünde ve iki yanında duruyorlar; dalları görüşün üst köşelerine
     * giriyor. Uçuş alanının (12) dışındalar.
     *
     * Katmanlı örneklemeye bırakılsaydı buraya ağaç düşüp düşmemesi şansa
     * kalırdı — kadrajın en önemli iki ağacı için kabul edilemez.
     */
    framing: [
      { x: 2.6, z: 12.4, scale: 1.05 },
      { x: -3.1, z: 13.1, scale: 0.95 },
    ],

    // Kamera başlangıcının bu yarıçapı içine ağaç ekilmiyor — yoksa
    // açılışta kamera gövdenin içinde kalabiliyor
    cameraClearance: 3.0,

    minRadius: 14,
    /*
     * Halka derin: en uzak ağaçlar 30 birimde ve sis onları belirgin şekilde
     * soluklaştırıyor. Sığ bir halkada (14–21) bütün ağaçlar aynı mesafede
     * kalıyor ve derinlik hissi oluşmuyor.
     */
    maxRadius: 30,
  },

  // ── Dağ duvarı ───────────────────────────────────────────────────────────
  /*
   * Alçak tepeler yok, yalnızca yüksek ve dik dağlar. Görevi manzara değil
   * DUVAR olmak: ötesini kapatıyor, dolayısıyla ötesini modellemeye gerek
   * kalmıyor.
   *
   * Tabanlar bilerek geniş ve halka üzerinde üst üste biniyor — aralarında
   * boşluk kalırsa arkadaki boş zemin görünüyor.
   */
  /*
   * Üç iç içe SIRT halkası. Ayrı ayrı koni değil — her halka kesintisiz
   * kapalı bir yüzey, dolayısıyla aralarından dış dünya görünmesi
   * geometrik olarak mümkün değil (bkz. terrain.js).
   *
   * `minHeight` her halkanın en alçak noktası. İç halkanınki, ufku her
   * açıdan kapatmayı garanti eden değer — düşürme.
   */
  mountains: {
    rings: [
      {
        /*
         * İç halka: ufku kapatan sırt.
         *
         * Yarıçap ve yükseklik BİRLİKTE ayarlanır. Kamera merkezden en çok
         * 13 birim uzaklaşabiliyor, yani eteğe en yakın mesafe
         * (radius − width − 13). 30 birimlik bir halkada bu 8 birime
         * düşüyordu ve 19 birimlik sırt görüşün 40°'sini yiyip sahneyi
         * kapatıyordu. Ekranda ~25°'yi geçmemeli.
         */
        radius: 46,
        width: 12, // etek ile tepe arasındaki yatay mesafe = yamaç eğimi
        minHeight: 8,
        maxHeight: 14,
        roughness: 0.7,
        color: 0x6a7896,
        topColor: 0x8794ad,
      },
      {
        radius: 60,
        width: 16,
        minHeight: 13,
        maxHeight: 22,
        roughness: 1.0,
        color: 0x77839e,
        topColor: 0x97a2b8,
      },
      {
        // Dış halka: yalnızca silüet derinliği. Sis onu iyice soluklaştırıyor.
        radius: 82,
        width: 22,
        minHeight: 18,
        maxHeight: 32,
        roughness: 1.4,
        color: 0x8e97ae,
        topColor: 0xaab2c4,
      },
    ],
  },

  // ── Zemin çimi ───────────────────────────────────────────────────────────
  /*
   * Çim artık GEOMETRİ DEĞİL, DOKU. Inkwell'in tepeden bakış çim karosu
   * zemine döşeniyor (bkz. atlas.js / groundcover.js).
   *
   * Önceki sürüm hazır GLB yamalarını serpiyordu ve zemini kaplamak
   * ~1.4 milyon üçgen tutuyordu. Doku bunu sıfıra indiriyor. Bedeli:
   * kameranın dibinde çim yapraklarının silueti yok.
   */
  groundGrass: {
    // Atlasın 3×2 ızgarasından hangi karo (0'dan başlar)
    tileCol: 1,
    tileRow: 1,
    /*
     * Bir karonun kaç dünya birimi kapladığı. Küçültmek dokuyu keskin ama
     * tekrarlı, büyütmek yumuşak ama bulanık yapıyor. 3 birim, kameranın
     * 2.2 birimlik göz yüksekliğinde tekrar fark edilmeyen en büyük değer.
     */
    tileSize: 3,
  },

  /*
   * Çim yaprakları — zeminin üstünde rüzgârda salınan 3B katman.
   * Zemin dokusunun YERİNE değil, ÜSTÜNE. Kaplamayı doku yapıyor,
   * yapraklar siluet ve hareket veriyor.
   *
   * Yaprak başına `segments * 2` üçgen (4 bölüm = 8 üçgen).
   */
  grassField: {
    count: 46000,
    radius: 34, // dağ eteklerine kadar
    height: 0.44,
    segments: 4,
    sway: 0.16, // rüzgâr genliği (yerel birim, boyla ölçekleniyor)
    seed: 0xc0ffee,
    colorBase: 0x6f9243,
    colorAlt: 0x9aae63,
  },

  /*
   * Çiçekler taçyapraklardan kuruluyor: çiçek başına 5–7 quad, yani
   * 10–14 üçgen. Eski GLB çiçekleri 198–2.524 üçgendi, o yüzden sayı
   * artık rahatça yükseltilebilir.
   */
  flowers: {
    count: 1400,
    radius: 22,
  },

  // ── Kamera ───────────────────────────────────────────────────────────────
  camera: {
    fov: 45,
    near: 0.1,
    far: 400,
    minDistance: 2.5,
    /*
     * Kamera uçuş alanının İÇİNDE kalıyor. 13, ağaç halkasının başladığı
     * 14'ün altında — yoksa geri çekilirken kamera ağacın içine giriyor ve
     * ekran çiçek dolusuyla kapanıyor.
     */
    maxDistance: 17,
    // Ufkun altına inip zeminin altını görmeyi engelliyor
    maxPolarAngle: Math.PI * 0.495,
    targetRadius: 5,
    /*
     * Kamera AĞAÇLARIN ARASINDA başlıyor (yarıçap 15.5), avlunun içinde
     * değil. Avlunun ortasından bakınca en yakın ağaç 5 birim uzakta
     * kalıyor ve çiçekler ekranın üst şeridinde küçük bir bant oluyor;
     * koruda durunca dallar kadraja giriyor ve sahne "içinde olunan" bir
     * yere dönüşüyor.
     *
     * `trees.framing` bunu şansa bırakmıyor: iki ağaç bilinçli olarak
     * görüş eksenine yakın yerleştiriliyor.
     */
    start: { x: 0, y: 2.4, z: 15.5 },
    targetY: 1.6,
  },
};

const DEG = Math.PI / 180;

/**
 * Derece cinsinden yükseklik/azimut açılarından birim yön vektörü.
 * Sonucu `out`'a yazar (Vector3) ve onu döndürür — çöp üretmiyor.
 */
export function sunDirection(elevation, azimuth, out) {
  return out.setFromSphericalCoords(1, (90 - elevation) * DEG, azimuth * DEG);
}
