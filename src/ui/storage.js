const KEY = 'butterfly-swarm/settings/v1';

/*
 * Panel ayarlarını localStorage'da tutar.
 *
 * Kayıtlı değerler varsayılanların ÜSTÜNE bindiriliyor, yerine geçmiyor:
 * kod yeni bir parametre eklediğinde eski kayıt onu silmesin ve kaldırılmış
 * bir parametre eski kayıttan geri gelmesin diye yalnızca hâlâ var olan
 * anahtarlar alınıyor.
 */

export function loadSettings(defaults) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };

    const saved = JSON.parse(raw);
    const merged = { ...defaults };
    for (const key of Object.keys(defaults)) {
      if (key in saved && typeof saved[key] === typeof defaults[key]) {
        merged[key] = saved[key];
      }
    }
    return merged;
  } catch {
    // Bozuk kayıt ya da localStorage kapalı — varsayılanlarla devam
    return { ...defaults };
  }
}

export function saveSettings(...objects) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.assign({}, ...objects)));
  } catch {
    // Kota dolu ya da gizli sekme — kayıt kritik değil, sessizce geç
  }
}

export function clearSettings() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* yok sayılabilir */
  }
}

/** Ardışık slider hareketlerinde her karede yazmamak için. */
export function debounce(fn, ms = 400) {
  let handle = 0;
  return (...args) => {
    clearTimeout(handle);
    handle = setTimeout(() => fn(...args), ms);
  };
}
