import { NextResponse } from 'next/server';
import { query } from '@/lib/server/db';

/*
 * ── Günlük süpürme (Aşama F) ──────────────────────────────────────────────
 *
 * Ömrü dolan kelebeğin kaydı SİLİNMİYOR, İNCELİYOR: renk ve çayırdaki yer
 * gidiyor, isim ve tarih geçmişte kalıyor (`HistoryCard`). Gizlilik metninin
 * sözü bu ve tutulduğu yer burası — o güne kadar renk sütunları dolu duruyordu
 * ve söz yalnızca sorguların onları seçmemesiyle "tutuluyor" görünüyordu.
 *
 * ⚠ Ekranda hiçbir şey bu işi BEKLEMİYOR. Kelebek ömrü dolar dolmaz çayırdan
 * ve listelerden düşüyor (sorgular `expires_at > now()` diyor); buradaki iş
 * yalnızca SAKLANAN veriyi kuralına uyduruyor. Bu yüzden günde bir kez yetiyor
 * ve gecikmesi bir şeyi bozmuyor.
 *
 * Vercel Cron `vercel.json`da tanımlı ve isteğe `Authorization: Bearer …`
 * ekliyor.
 */

/** Çerez okumasa da her istekte çalışmak zorunda: sonucu önbelleğe alınamaz. */
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;

  /*
   * ⚠ Parola yoksa uç nokta HİÇBİR isteği kabul etmiyor.
   *
   * Postadaki ve Turnstile'daki karar burada TERS yönde işliyor ve sebebi
   * simetrik: orada anahtarsızlık kapıyı kapatırdı (kullanıcı bir şey
   * yapamazdı), burada anahtarsızlık kapıyı AÇIK bırakır — herkesin
   * çağırabildiği bir bakım uç noktası. Açık kalan bir kapı, hiç çalışmayan
   * bir işten kötü.
   */
  if (!secret) {
    console.error('[cron] CRON_SECRET yok — süpürme ÇALIŞMADI');
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'no' }, { status: 401 });
  }

  try {
    /*
     * 1 — Ömrü dolan ÜYE kelebeğinin rengi siliniyor, satırı duruyor.
     *
     * `fore_hex is not null` koşulu işi tekrar tekrar yapmaktan koruyor:
     * ikinci çalıştırmada eşleşen satır kalmıyor (kısmi indeks de tam bu
     * koşulda, `0001_schema.sql`).
     */
    const faded = await query<{ id: string }>(
      `update garden.butterfly
          set fore_hex = null, hind_hex = null
        where expires_at <= now()
          and fore_hex is not null
          and owner_id is not null
      returning id`,
    );

    /*
     * 2 — Ömrü dolan MİSAFİR kelebeği bütünüyle siliniyor.
     *
     * Üyeninkinden farkı geriye kalacak bir şeyin OLMAMASI: misafirin listesi
     * yok, ismi yok, geçmiş ekranı yok. Rengi boşaltılmış bir satır kimsenin
     * bakmadığı bir kayıt olurdu; gizlilik metni de misafir için "we store the
     * butterfly itself and nothing about you" diyor — o kelebek gidince
     * geriye hiçbir şey kalmıyor.
     *
     * ⚠ Sayaç ETKİLENMİYOR: `garden.counters` ayrı bir satır ve kelebek
     * sayısından türetilmiyor (bkz. 0001). Silinen kelebek salınmış olmaktan
     * çıkmıyor.
     */
    const swept = await query<{ id: string }>(
      `delete from garden.butterfly
        where expires_at <= now()
          and owner_id is null
      returning id`,
    );

    // 3 — Ölü oturumlar ve kullanılmış/süresi geçmiş bağlantılar.
    const sessions = await query<{ token_hash: Buffer }>(
      'delete from garden.session where expires_at <= now() returning token_hash',
    );
    const tokens = await query<{ token_hash: Buffer }>(
      `delete from garden.email_token
        where expires_at <= now() or used_at is not null
      returning token_hash`,
    );

    return NextResponse.json({
      faded: faded.length,
      swept: swept.length,
      sessions: sessions.length,
      tokens: tokens.length,
    });
  } catch (error) {
    console.error('[cron] süpürme başarısız:', error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
