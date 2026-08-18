/*
 * Renk yardımcıları — özel renk seçici için.
 *
 * Seçicinin alanı GERÇEK HSV değil. Tasarımdaki gradyan şöyle tanımlı:
 *
 *   yatay:  linear-gradient(90deg, #F6EFE9, <ton>)
 *   dikey:  linear-gradient(180deg, transparent, #17231F)
 *
 * Yani sol kenar beyaz değil KREM, alt kenar siyah değil koyu yeşilimsi bir
 * mürekkep. Standart bir HSV seçici kullanılsaydı imlecin altındaki piksel
 * ile seçilen renk tutmazdı — kullanıcı gördüğünden farklı bir renk alırdı.
 *
 * Bu yüzden renk, gradyanın kendisiyle AYNI formülden hesaplanıyor:
 * ne görünüyorsa o seçiliyor.
 */

const FIELD_LEFT = [0xf6, 0xef, 0xe9] as const;
const FIELD_BOTTOM = [0x17, 0x23, 0x1f] as const;

export function hueToRgb(hue: number): [number, number, number] {
  const h = ((hue % 360) + 360) % 360;
  const x = Math.round(255 * (1 - Math.abs(((h / 60) % 2) - 1)));
  if (h < 60) return [255, x, 0];
  if (h < 120) return [x, 255, 0];
  if (h < 180) return [0, 255, x];
  if (h < 240) return [0, x, 255];
  if (h < 300) return [x, 0, 255];
  return [255, 0, x];
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function toHex(r: number, g: number, b: number): string {
  const p = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return ('#' + p(r) + p(g) + p(b)).toUpperCase();
}

/**
 * Alan koordinatından renk.
 * @param sx 0-1 soldan sağa
 * @param sy 0-1 yukarıdan aşağı
 */
export function fieldColour(hue: number, sx: number, sy: number): string {
  const rgb = hueToRgb(hue);
  const r = mix(mix(FIELD_LEFT[0], rgb[0], sx), FIELD_BOTTOM[0], sy);
  const g = mix(mix(FIELD_LEFT[1], rgb[1], sx), FIELD_BOTTOM[1], sy);
  const b = mix(mix(FIELD_LEFT[2], rgb[2], sx), FIELD_BOTTOM[2], sy);
  return toHex(r, g, b);
}

/**
 * Yazılan metni hex renge çevirir.
 *
 * Baştaki diyez isteğe bağlı, büyük/küçük harf fark etmiyor, üç haneli kısa
 * yazım genişletiliyor. Geçersizse null döner ve çağıran taraf eski rengi
 * korur — yazarken her ara adımda renk sıçramasın diye.
 */
export function parseHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const c = raw.split('');
    return ('#' + c[0] + c[0] + c[1] + c[1] + c[2] + c[2]).toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return ('#' + raw).toUpperCase();
  return null;
}
