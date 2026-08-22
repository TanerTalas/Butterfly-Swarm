import { createHash, randomBytes } from 'node:crypto';
import { query, queryOne } from '@/lib/server/db';

/*
 * E-posta bağlantılarındaki tek kullanımlık token'lar.
 *
 * Oturum token'ıyla aynı kural: ham token yalnızca postadaki bağlantıda, veri-
 * tabanında SHA-256 özeti duruyor.
 */

export type TokenPurpose = 'verify' | 'reset';

/*
 * ⚠ ÖMÜR BİR SAAT ve bu keyfi bir sayı DEĞİL: `SignInCard` → `VerifyCard`
 * ekranda "the link lasts an hour" diye söz veriyor. Burası değişecekse o cümle
 * de değişmeli — kullanıcıya verilen sözün tek teknik karşılığı bu sabit.
 */
const TOKEN_MINUTES = 60;

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

/**
 * Yeni bir token üretir, kaydeder ve HAM hâlini döndürür.
 *
 * Ham hâli yalnızca bir kez, burada görülüyor; çağıran taraf onu postaya koyup
 * unutuyor.
 */
export async function issueEmailToken(
  accountId: string,
  purpose: TokenPurpose,
  run: typeof query = query,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_MINUTES * 60_000);

  /*
   * Aynı amaçla duran eski token'lar düşüyor: kullanıcı "tekrar gönder" derse
   * eskisinin de çalışmaya devam etmesi, bağlantının ömrünü sessizce uzatırdı.
   */
  await run('delete from garden.email_token where account_id = $1 and purpose = $2', [
    accountId,
    purpose,
  ]);

  await run(
    `insert into garden.email_token (token_hash, account_id, purpose, expires_at)
     values ($1, $2, $3, $4)`,
    [hashToken(token), accountId, purpose, expiresAt],
  );

  return token;
}

/**
 * Token'ı doğrular ve TÜKETİR. Geçerliyse hesabın kimliğini döndürür.
 *
 * ⚠ Tüketme ile doğrulama TEK sorguda. İki ayrı adım olsaydı, aynı bağlantıya
 * aynı anda iki kez tıklanınca ikisi de geçerli görürdü; `used_at is null`
 * koşulunu `update`in içine koymak bu yarışı veritabanına çözdürüyor.
 */
export async function consumeEmailToken(
  token: string,
  purpose: TokenPurpose,
): Promise<string | null> {
  const row = await queryOne<{ account_id: string }>(
    `update garden.email_token
        set used_at = now()
      where token_hash = $1
        and purpose = $2
        and used_at is null
        and expires_at > now()
      returning account_id`,
    [hashToken(token), purpose],
  );

  return row?.account_id ?? null;
}
