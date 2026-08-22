import { headers } from 'next/headers';
import { createHmac } from 'node:crypto';
import { query, queryOne } from '@/lib/server/db';

/*
 * İletişim mesajları — sunucu içi yardımcılar (Aşama E.4).
 *
 * ⚠ Burası `'use server'` DEĞİL ve olmamalı. O dosyalardaki her export
 * tarayıcının POST edebildiği genel bir uç nokta; IP özetleyen ve satır yazan
 * yardımcıların yeri `lib/server/` (CLAUDE.md → Kimlik).
 *
 * Form sitedeki İKİNCİ kimliksiz yazma noktası (ilki misafir salma) ve
 * ondan bir farkı var: salmanın kendiliğinden duran bir sınırı var (kontenjan
 * tavanı), serbest metnin yok. Sınırı buradaki iki şey veriyor — saatlik
 * kısıt ve bot kontrolü (`turnstile.ts`).
 */

/** Aynı yerden saat başına kabul edilen mesaj. */
const MAX_PER_HOUR = 3;

/**
 * İsteğin geldiği IP.
 *
 * ⚠ Vekil başlıkları İSTEMCİ TARAFINDAN uydurulabilir; güvenilir olmalarının
 * tek sebebi önlerinde başlığı kendisi yazan bir vekilin (Vercel) durması.
 * Bu yüzden buradan gelen değer bir KANIT değil, yalnızca bir kısıt anahtarı:
 * yanlış olması birinin fazladan mesaj göndermesi demek, birinin başkası gibi
 * görünmesi değil.
 *
 * `x-forwarded-for` zincir taşıyor (`istemci, vekil1, vekil2`); ilk değer
 * istemciye en yakın olan.
 */
export async function clientIp(): Promise<string | null> {
  const head = await headers();

  const forwarded = head.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return head.get('x-real-ip')?.trim() || null;
}

/**
 * IP'nin özeti — adresin kendisi hiçbir yere yazılmıyor.
 *
 * Sorduğumuz tek soru "aynı yerden mi geldi"; adresin kendisini saklamak,
 * sormadığımız bir soruyu yanıtlayan bir veri tutmak olurdu.
 *
 * ⚠ Düz SHA-256 YETMEZ: IPv4 uzayı 2^32, yani bütün adreslerin özeti bir
 * öğleden sonrada çıkarılabilir ve tablo "gizlenmiş" değil sadece kodlanmış
 * olurdu. Anahtarlı özet (HMAC) o listeyi çıkarılamaz yapıyor.
 *
 * ⚠ `IP_HASH_SECRET` boşsa özet yine üretiliyor ama anahtarsız — kısıt
 * çalışmaya devam etsin diye. Üretimde bu bir eksik ve loglarda öyle
 * görünüyor; anahtar DEĞİŞİRSE eski satırların özetleri eşleşmez olur, ki
 * kısıt bir saatlik olduğu için bedeli bir saat.
 */
export function hashIp(ip: string | null): Buffer | null {
  if (!ip) return null;

  const secret = process.env.IP_HASH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    console.error('[contact] IP_HASH_SECRET yok — IP özeti ANAHTARSIZ');
  }

  return createHmac('sha256', secret || 'butterfly-garden').update(ip).digest();
}

/**
 * Bu adresten son bir saatte kaç mesaj geldi.
 *
 * ⚠ Adres bilinmiyorsa kısıt UYGULANMIYOR (`false` dönüyor). Bilinmeyen bir
 * anahtarla sayılan her mesaj aynı kovaya düşerdi ve bir kişinin gönderdiği
 * üç mesaj, adresi okunamayan HERKESİ susturur.
 */
export async function tooManyFrom(ipHash: Buffer | null): Promise<boolean> {
  if (!ipHash) return false;

  const row = await queryOne<{ recent: number }>(
    `select count(*)::int as recent
       from garden.contact_message
      where ip_hash = $1
        and created_at > now() - interval '1 hour'`,
    [ipHash],
  );

  return (row?.recent ?? 0) >= MAX_PER_HOUR;
}

/**
 * Mesajı saklar.
 *
 * ⚠ Hesap kimliği ÇEREZDEN geliyor, formdan değil (çağıran `readSession`
 * okuyor). Formdaki e-posta kanıtlanmamış bir iddia; sütundaki hesap
 * kanıtlanmış olan ve "verimi silin" diyen bir mesajın kime ait olduğu ancak
 * ondan bilinebiliyor.
 */
export async function storeMessage(input: {
  accountId: string | null;
  name: string;
  email: string;
  body: string;
  ipHash: Buffer | null;
}): Promise<void> {
  await query(
    `insert into garden.contact_message
       (account_id, name, email, body, ip_hash)
     values ($1, $2, $3, $4, $5)`,
    [input.accountId, input.name, input.email, input.body, input.ipHash],
  );
}
