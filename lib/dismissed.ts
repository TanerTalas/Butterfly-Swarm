/*
 * Kapatılmış bildirimler.
 *
 * Şimdilik tek bir tanesi var: sahne çizilemediğinde çıkan şerit (D8).
 * Bilgi bir kez okunuyor, sonrası gürültü — ama sonsuza dek gizlemek de
 * yanlış olurdu: WebGL her açılışta yok olacak ve aylar sonra dönen
 * kullanıcı hareketsiz bir çayırla açıklamasız kalırdı.
 *
 * Bu yüzden `sessionStorage`: kapatma SEKME ömrü kadar yaşıyor. Aynı sekmede
 * bir daha görünmüyor, yeni sekmede bir kez daha söylüyor.
 *
 * ⚠ Her erişim `try` içinde, `lib/draft.ts` ile aynı sebeple: depo var
 * olmayabilir, Safari'nin özel kipinde `setItem` kota hatası fırlatıyor ve
 * bazı tarayıcılarda üçüncü taraf çerezleri kapalıyken `window.sessionStorage`
 * okumanın kendisi bile atıyor. Bir bildirimi gizlemek bir kolaylık;
 * başarısız olması ekranı kırmamalı.
 */

const KEY = 'butterfly-garden:scene-notice-dismissed';

export function isNoticeDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissNotice(): void {
  try {
    window.sessionStorage.setItem(KEY, '1');
  } catch {
    /* depo kapalı; şerit bu sekmede yeniden görünecek, ekran çalışmaya devam */
  }
}
