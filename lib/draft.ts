/*
 * Yarım kalmış kelebek — seçilmiş renkler ve yazılmış isim.
 *
 * Kanat seçimi kartı bir formdan fazlası: kullanıcı renk deniyor, isim
 * arıyor, önizlemeye bakıp geri dönüyor. O emek sayfa yenilenince
 * kayboluyordu. Burada saklanıyor.
 *
 * ── Neden `sessionStorage` ────────────────────────────────────────────────
 *
 * `localStorage` kalıcı: paylaşılan bir bilgisayarda bir sonraki kişi
 * öncekinin yarım kelebeğini bulurdu. Taslak sekmenin ömrü kadar yaşamalı,
 * o yüzden `sessionStorage`.
 *
 * ── Neden her erişim `try` içinde ─────────────────────────────────────────
 *
 * `sessionStorage` VAR OLMAYABİLİR ve varlığı yetmez: Safari'nin özel
 * kipinde nesne duruyor ama `setItem` kota hatası fırlatıyor, bazı
 * tarayıcılarda üçüncü taraf çerezleri kapalıyken `window.sessionStorage`
 * okumanın kendisi bile atıyor. Taslak korumak bir kolaylık; başarısız
 * olması ekranı kırmamalı.
 *
 * ⚠ Bu sunucudaki taslak DEĞİL. Başka cihazda ya da başka sekmede yok;
 * amacı yalnızca yenilemeye ve geri tuşuna dayanmak (D5'teki "tekrar
 * denemek aynı kelebeği salacak" sözünün istemci tarafı).
 */

const KEY = 'butterfly-garden:wing-draft';

export type WingDraft = {
  name: string;
  fore: string;
  hind: string;
};

/** Taslağı okur; yoksa, bozuksa ya da depo kapalıysa `null`. */
export function readDraft(): WingDraft | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isDraft(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Taslağı yazar. Başarısızlığı yutuyor — bkz. yukarıdaki not. */
export function writeDraft(draft: WingDraft): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* depo kapalı ya da dolu; taslak korunamıyor, ekran çalışmaya devam */
  }
}

/** Kelebek gerçekten salındığında çağrılıyor — taslak artık bir kelebek. */
export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* yukarıdaki ile aynı */
  }
}

/*
 * Depodan gelen her şey GÜVENİLMEZ. Kullanıcı (ya da eski bir sürüm)
 * oraya herhangi bir şey yazmış olabilir; şekli doğrulanmadan React
 * durumuna konursa kart tanımsız bir renkle çiziliyor.
 */
function isDraft(value: unknown): value is WingDraft {
  if (typeof value !== 'object' || value === null) return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.name === 'string' &&
    typeof d.fore === 'string' &&
    typeof d.hind === 'string'
  );
}
