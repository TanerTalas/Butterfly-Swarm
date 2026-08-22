import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { query, queryOne } from '@/lib/server/db';
import type { Profile } from '@/lib/types';

/*
 * Oturum — opak token, veritabanında özeti.
 *
 * JWT kullanılmadı ve sebebi İPTAL EDİLEBİLİRLİK: hesap silindiğinde ya da
 * "bütün oturumları kapat" dendiğinde imzalı bir token'ı geri almanın yolu yok,
 * satırı silmenin var. Hesap silmenin verdiği söz ("bütün oturumlar sonlanıyor")
 * ancak böyle tutulabiliyor.
 *
 * ⚠ Veritabanında token'ın KENDİSİ değil SHA-256 ÖZETİ duruyor. Veritabanı
 * sızarsa elde edilen şey canlı oturumlar değil, işe yaramaz özetler olsun.
 * Özet için tuz/yavaşlatma gerekmiyor: token 256 bit rastgele, yani sözlük
 * saldırısına konu olacak bir yapısı yok.
 */

const COOKIE = 'garden_session';

/** Oturum ömrü. Kullanıcı "beni hatırla" demiyor; tek bir makul süre var. */
const SESSION_DAYS = 30;

export type SessionState =
  /** Giriş yapılmamış. Çayır yine de görünüyor — misafir de kelebek salabiliyor. */
  | { kind: 'guest' }
  /**
   * Kayıt tamamlanmış ama hesap kurulumu YAPILMAMIŞ: `account.name` NULL.
   *
   * Ayrı bir hâl olması şart. Arayüz bu kullanıcıyı `setup` ekranına götürmek
   * zorunda; üye gibi davranılsaydı isimsiz bir profille çayıra girer ve
   * kelebeğinin yanında boş bir isim görünürdü.
   */
  | { kind: 'incomplete'; accountId: string; email: string }
  | { kind: 'member'; accountId: string; profile: Profile };

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

/**
 * Yeni oturum açar ve çerezi yazar.
 *
 * ⚠ Yalnızca Server Action ve Route Handler içinden çağrılabilir — Next, Server
 * Component render'ı sırasında çerez yazdırmıyor.
 */
export async function createSession(accountId: string): Promise<void> {
  // 256 bit. Tahmin edilebilir olmaması gereken tek şey bu.
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await query(
    'insert into garden.session (token_hash, account_id, expires_at) values ($1, $2, $3)',
    [hashToken(token), accountId, expiresAt],
  );

  const store = await cookies();
  store.set(COOKIE, token, {
    /*
     * ⚠ Dördü de şart:
     *   httpOnly  JavaScript token'a erişemiyor — XSS de erişemiyor demek.
     *   secure    üretimde yalnızca HTTPS. Geliştirmede kapalı, yoksa
     *             http://localhost'ta çerez hiç yazılmazdı.
     *   sameSite  'lax': başka sitenin gönderdiği POST'a çerez eklenmiyor
     *             (CSRF), ama e-postadaki doğrulama bağlantısıyla gelen
     *             normal gezinme çalışıyor. 'strict' olsaydı o bağlantı
     *             kullanıcıyı çıkış yapmış gösterirdi.
     *   path      tek sayfa, tek kapsam.
     */
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/**
 * Çerezdeki oturumu okur ve profili getirir.
 *
 * Server Component'ten de Server Action'dan da çağrılabilir. Hiçbir şey
 * fırlatmıyor: oturum yoksa ya da veritabanı cevap vermiyorsa `guest` dönüyor —
 * çayır kimliksiz de çalışan bir yer, giriş yapılamaması sayfayı çökertmemeli.
 */
export async function readSession(): Promise<SessionState> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE)?.value;
    if (!token) return { kind: 'guest' };

    /*
     * Süre kontrolü SORGUDA. Uygulamada yapılsaydı, saati geçmiş bir satır
     * silinene kadar geçerli sayılabilirdi; burada veritabanının kendi saati
     * karar veriyor.
     */
    const row = await queryOne<{
      account_id: string;
      email: string;
      name: string | null;
      avatar_hex: string | null;
    }>(
      `select a.id as account_id, a.email, a.name, a.avatar_hex
         from garden.session s
         join garden.account a on a.id = s.account_id
        where s.token_hash = $1
          and s.expires_at > now()`,
      [hashToken(token)],
    );

    if (!row) return { kind: 'guest' };

    if (!row.name || !row.avatar_hex) {
      return { kind: 'incomplete', accountId: row.account_id, email: row.email };
    }

    return {
      kind: 'member',
      accountId: row.account_id,
      profile: {
        name: row.name,
        email: row.email,
        avatarHex: row.avatar_hex,
      },
    };
  } catch {
    return { kind: 'guest' };
  }
}

/** Bu oturumu kapatır: satırı siler, çerezi düşürür. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;

  if (token) {
    /*
     * Satır silinemese bile çerez düşüyor: kullanıcı çıkmak istedi ve arayüz
     * çıkmış gibi davranmak zorunda. Ekranda "çıkış yapılamadı" diye bir hâl
     * yok ve olması da gerekmiyor.
     */
    try {
      await query('delete from garden.session where token_hash = $1', [
        hashToken(token),
      ]);
    } catch {
      // yut
    }
  }

  store.delete(COOKIE);
}

/**
 * Hesabın BÜTÜN oturumlarını kapatır.
 *
 * Hesap silmenin verdiği sözün karşılığı (`lib/legal.ts`). Şifre değişiminde de
 * gerekecek.
 */
export async function destroyAllSessions(accountId: string): Promise<void> {
  await query('delete from garden.session where account_id = $1', [accountId]);
}
