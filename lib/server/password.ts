import { hash, verify, hashSync, type Algorithm } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import { PASSWORD_MIN } from '@/lib/types';

/*
 * Şifre özetleme — argon2id.
 *
 * ⚠ Düz şifre hiçbir yerde saklanmıyor, loglanmıyor, hata mesajına girmiyor.
 * Bu dosyanın dışına çıkan tek şey bir özet ya da bir boolean.
 */

/*
 * argon2id: argon2i'nin yan kanal direncini argon2d'nin GPU direnciyle
 * birleştiren melez. Şifre özetlemede önerilen varyant ve kütüphanenin de
 * varsayılanı — yine de açıkça yazılıyor, varsayılan değişirse sessizce başka
 * bir algoritmaya geçilmesin.
 *
 * ⚠ Sayı elle yazılmak zorunda (`Algorithm.Argon2id` = 2): `Algorithm` bir
 * `const enum` ve Next'in gerektirdiği `isolatedModules` altında ona DEĞER
 * olarak erişilemiyor. Tip yine de kontrol ediliyor.
 */
const OPTIONS = {
  algorithm: 2 as Algorithm,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

/*
 * KAYITLI OLMAYAN bir e-posta için harcanacak sahte özet.
 *
 * ⚠ Bu bir hile değil, güvenlik kuralının kendisi. Hesap yoksa doğrulama
 * atlanırsa cevap belirgin biçimde daha hızlı döner ve o süre farkı "bu e-posta
 * kayıtlı mı" sorusunu yanıtlar — girişteki tek mesaj kuralı (CLAUDE.md) ölçüm
 * yoluyla delinmiş olurdu. `verifyPassword` hesap yokken de aynı işi yapıyor.
 *
 * Modül yüklenirken BİR KEZ üretiliyor; içeriğinin ne olduğu önemsiz, maliyeti
 * gerçek bir özetle aynı olsun yeter.
 */
const DUMMY_HASH = hashSync(randomBytes(32).toString('hex'), OPTIONS);

/**
 * Şifreyi özetle karşılaştırır.
 *
 * `stored` null ise (hesap yok) sahte bir özetle aynı işi yapıp `false`
 * döndürüyor — yukarıdaki nota bak.
 */
export async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  try {
    const result = await verify(stored ?? DUMMY_HASH, password, OPTIONS);
    return stored === null ? false : result;
  } catch {
    // Bozuk ya da tanınmayan özet biçimi: giriş başarısız, ama gürültü yok.
    return false;
  }
}

/**
 * En kısa şifre kuralı.
 *
 * ⚠ Sayı `lib/types.ts`ten (`PASSWORD_MIN`) okunuyor, buraya kopyalanmıyor:
 * alan notu, hata rengi, buton kilidi ve bu kontrol dördü de aynı sayıyı
 * görmek zorunda.
 */
export function isPasswordAcceptable(password: string): boolean {
  return password.length >= PASSWORD_MIN;
}
