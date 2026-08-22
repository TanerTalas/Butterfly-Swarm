import * as THREE from 'three';

/*
 * Takip kamerası — "bu kelebeği izle".
 *
 * Kamera kelebeğe KİLİTLENMİYOR, onu TAŞIYOR. Fark önemli: kullanıcı izlerken
 * de sahneyi döndürebiliyor ve yakınlaşabiliyor; biz yalnızca yörüngenin
 * merkezini kelebeğin üstünde tutuyoruz.
 *
 * Bunun yolu `OrbitControls`'ün her karede kamera konumunu OKUMASI:
 * `update()` içinde ofset `camera.position - target` olarak yeniden
 * türetiliyor. Yani hedefi ve kamerayı AYNI vektörle kaydırırsak yörünge
 * açıları hiç bozulmuyor; kullanıcının o an baktığı yön korunuyor.
 *
 * Kelebek küçük (kanat açıklığı ~0.58 birim) ve hızlı yön değiştiriyor.
 * İki şey bu yüzden yumuşatılıyor:
 *
 *   hedef   — üstel yumuşatma. Kamera kelebeğin tam üstünde değil, hafif
 *             gerisinde kalıyor ve bu iyi görünüyor: sert kilit, kelebeğin
 *             her kanat vuruşunu ekrana sarsıntı olarak yansıtıyordu.
 *   mesafe  — kullanıcı 15 birim uzaktan bakıyor olabilir; o mesafede kelebek
 *             birkaç piksel. Girişte mesafe kendiliğinden yakınlaşıyor.
 *
 * ⚠ İNDEKS SAKLANMIYOR. Kelebeğin instance indeksi liste değiştikçe
 * kayıyor (bkz. `visitors.js`), o yüzden her karede `positionOf(id)`
 * soruluyor. Kelebek çayırdan kalkarsa takip kendiliğinden bırakıyor.
 */

/** Girişin ve çıkışın süresi (saniye). */
const ENGAGE_TIME = 1.3;

/** İzlerken hedeflenen kamera mesafesi. */
const WATCH_DISTANCE = 2.4;

/** İzlerken izin verilen en yakın mesafe — kullanıcı burnuna kadar girebilsin. */
const WATCH_MIN_DISTANCE = 0.9;

/**
 * @param {{
 *   camera: THREE.PerspectiveCamera,
 *   controls: import('three/addons/controls/OrbitControls.js').OrbitControls,
 *   minDistance: number,
 *   positionOf: (id: string) => THREE.Vector3 | null,
 * }} deps
 */
export function createFollowCam({ camera, controls, minDistance, positionOf }) {
  const home = { target: new THREE.Vector3(), distance: 0 };
  const desired = new THREE.Vector3();
  const step = new THREE.Vector3();
  const offset = new THREE.Vector3();

  let id = null;
  /** 'off' | 'in' | 'out' */
  let phase = 'off';
  /** 0 = kullanıcının bıraktığı görüş, 1 = kelebeğin üstünde. */
  let engage = 0;

  /**
   * İzlemeye başla. Kelebek çayırda değilse hiçbir şey yapmıyor.
   *
   * Kullanıcının O ANKİ görüşü saklanıyor: izleme bittiğinde kamera
   * buraya dönecek. Sabit bir "başlangıç görüşüne" dönmek, sahneyi
   * kendi istediği açıya çevirmiş birinin emeğini siliyor.
   */
  function watch(nextId) {
    if (positionOf(nextId) === null) return false;

    if (phase === 'off') {
      home.target.copy(controls.target);
      home.distance = camera.position.distanceTo(controls.target);
    }

    id = nextId;
    phase = 'in';
    return true;
  }

  /** İzlemeyi bırak — kamera kullanıcının bıraktığı görüşe dönüyor. */
  function stop() {
    if (phase === 'off') return;
    phase = 'out';
    id = null;
  }

  /**
   * Kareyi işler.
   *
   * @returns {boolean} takip etkin mi — `true` ise çağıran taraf kendi hedef
   *   sınırlamasını UYGULAMAMALI: kelebek avlunun kenarına kadar gidiyor,
   *   `cam.targetRadius` ise 5 birimlik bir disk. İkisi birden çalışırsa
   *   kamera kelebeğe yetişemeyip sınırda titriyor.
   */
  function update(dt) {
    if (phase === 'off') return false;

    if (phase === 'in') {
      const p = positionOf(id);
      if (p === null) {
        // Kelebek çayırdan kalktı (ömrü doldu, hesap silindi). Takip
        // sessizce bırakıyor; kullanıcı izleme kipinden kendisi çıkacak.
        stop();
        return update(dt);
      }
      desired.copy(p);
      engage = Math.min(1, engage + dt / ENGAGE_TIME);
    } else {
      desired.copy(home.target);
      engage = Math.max(0, engage - dt / ENGAGE_TIME);
    }

    /*
     * Yakalama gücü girişte artıyor: uzaktaki kelebeğe doğru yumuşak bir
     * savruluşla gidiliyor, yaklaştıkça takip sıkılaşıyor. Baştan sıkı
     * olsaydı kamera ilk karede sahnenin öbür ucuna fırlıyordu.
     */
    const gain = phase === 'in' ? 1.8 + 3.7 * engage : 2.2;
    step.copy(desired).sub(controls.target);
    step.multiplyScalar(1 - Math.exp(-gain * dt));

    controls.target.add(step);
    camera.position.add(step); // ofset korunuyor: kullanıcının açısı bozulmuyor

    // ── Mesafe ────────────────────────────────────────────────────────────
    offset.copy(camera.position).sub(controls.target);
    const length = offset.length();
    if (length > 1e-4) {
      const want = THREE.MathUtils.lerp(home.distance, WATCH_DISTANCE, engage);
      const next = THREE.MathUtils.lerp(
        length,
        want,
        1 - Math.exp(-2.4 * dt),
      );
      camera.position
        .copy(controls.target)
        .addScaledVector(offset, next / length);
    }

    /*
     * Alt sınır da yumuşak: izlerken 0.9'a iniyor, çıkarken 2.5'e dönüyor.
     * Doğrudan geri yazılsaydı `OrbitControls` mesafeyi tek karede kırpıp
     * kamerayı geri fırlatırdı.
     */
    controls.minDistance = THREE.MathUtils.lerp(
      minDistance,
      WATCH_MIN_DISTANCE,
      engage,
    );

    /*
     * Çıkış İKİ koşula birden bakıyor: hedef yerine oturmalı VE mesafe
     * kullanıcının bıraktığı değere dönmeli. Yalnızca hedefe bakılsaydı
     * takip, kamera hâlâ yarım birim içerideyken kapanıyor ve kullanıcı
     * bıraktığından biraz daha yakında kalıyordu.
     */
    if (phase === 'out' && engage <= 0) {
      const drift = Math.abs(
        camera.position.distanceTo(controls.target) - home.distance,
      );
      if (step.lengthSq() < 1e-6 && drift < 0.02) {
        phase = 'off';
        controls.minDistance = minDistance;
      }
    }

    return true;
  }

  return {
    watch,
    stop,
    update,
    /** Şu an izlenen kelebek — hiçbiri izlenmiyorsa null. */
    get watching() {
      return phase === 'in' ? id : null;
    },
  };
}
