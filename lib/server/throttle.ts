import { query, queryOne } from '@/lib/server/db';

/*
 * Giriş denemesi kısıtı.
 *
 * `SignInCard` bu hâli zaten çiziyor: buton "Too many attempts" olup
 * kilitleniyor ve `SignInError` içinde `rate-limit` diye bir tür var.
 *
 * ⚠ Anahtar KAYITLI OLMAYAN e-postalar için de tutuluyor. Yalnızca var olan
 * hesaplar kısıtlansaydı, kısıtın devreye girip girmemesi "bu e-posta kayıtlı
 * mı" sorusunu yanıtlardı — girişteki tek mesaj kuralını ölçüm yoluyla delerdi.
 *
 * ⚠ Bilinen zayıflık: anahtar e-posta olduğu için, birinin adresini bilen biri
 * o hesabı kasten kilitleyebilir. Asıl çözüm IP başına kısıt ve kötüye kullanım
 * işinin geri kalanıyla birlikte E.2'de geliyor; buradaki kilit kısa ömürlü
 * olduğu için zarar da kısa ömürlü.
 */

const MAX_FAILURES = 10;
const WINDOW_MINUTES = 15;
const LOCK_MINUTES = 15;

/** E-postayı anahtara çevirir — büyük/küçük harf ve boşluk fark etmiyor. */
export function attemptKey(email: string): string {
  return email.trim().toLowerCase();
}

/** Kilitliyse kaç saniye kaldığını döndürür, değilse null. */
export async function lockedFor(key: string): Promise<number | null> {
  const row = await queryOne<{ seconds: number }>(
    `select ceil(extract(epoch from (locked_until - now())))::int as seconds
       from garden.sign_in_attempt
      where email_key = $1 and locked_until > now()`,
    [key],
  );

  return row ? Math.max(1, row.seconds) : null;
}

/**
 * Başarısız denemeyi sayar; tavana çarpınca kilitler.
 *
 * Sayaç PENCEREYLE sıfırlanıyor: on beş dakika içinde on kez yanılan
 * kilitleniyor, ayda bir yanılan kilitlenmiyor. Tek sorguda, çünkü iki kişi
 * aynı anda deniyorsa okuma ile yazma arasına başka bir deneme girebilir.
 */
export async function recordFailure(key: string): Promise<void> {
  await query(
    `insert into garden.sign_in_attempt (email_key, failures, first_at)
     values ($1, 1, now())
     on conflict (email_key) do update set
       failures = case
         when sign_in_attempt.first_at < now() - make_interval(mins => $2)
           then 1
         else sign_in_attempt.failures + 1
       end,
       first_at = case
         when sign_in_attempt.first_at < now() - make_interval(mins => $2)
           then now()
         else sign_in_attempt.first_at
       end,
       locked_until = case
         when sign_in_attempt.failures + 1 >= $3
           then now() + make_interval(mins => $4)
         else sign_in_attempt.locked_until
       end`,
    [key, WINDOW_MINUTES, MAX_FAILURES, LOCK_MINUTES],
  );
}

/** Başarılı girişten sonra sayacı temizler. */
export async function clearFailures(key: string): Promise<void> {
  await query('delete from garden.sign_in_attempt where email_key = $1', [key]);
}
