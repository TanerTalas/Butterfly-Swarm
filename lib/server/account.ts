import { queryOne } from '@/lib/server/db';
import type { AccountFacts } from '@/lib/types';

/*
 * Hesabın kendisiyle ilgili üç değer: "Hesabım" ekranındaki iki sayı ve
 * ayarlardaki kilit. Üçü tek satırdan çıkıyor, o yüzden tek sorgu — sayfa
 * açılışı zaten birkaç sorgu yapıyor ve veritabanı Frankfurt'ta (bkz.
 * `vercel.json`, bölge `fra1`).
 *
 * ⚠ Şeklin kendisi `lib/types.ts`te: bu değer sunucu/istemci sınırını geçiyor
 * (`app/page.tsx` → `Garden`) ve sınırı geçen tipler orada duruyor. Buradan
 * export edilseydi istemci tarafı bir SUNUCU modülünden tip çekerdi.
 */
export async function readAccountFacts(
  accountId: string,
): Promise<AccountFacts | null> {
  try {
    const row = await queryOne<{
      created_at: Date;
      profile_locked_until: Date | null;
      released_total: number;
    }>(
      `select a.created_at,
              a.profile_locked_until,
              (select count(*)::int
                 from garden.butterfly b
                where b.owner_id = a.id) as released_total
         from garden.account a
        where a.id = $1`,
      [accountId],
    );

    if (!row) return null;

    return {
      /*
       * Geçmiş bir an KİLİT DEĞİL ve burada temizleniyor: istemciye "kilitli
       * ama süresi dolmuş" diye bir hâl geçmiyor, ekranın karşılaştırma
       * yapması gerekmiyor.
       */
      lockedUntil:
        row.profile_locked_until && row.profile_locked_until > new Date()
          ? row.profile_locked_until
          : null,
      memberSince: row.created_at,
      releasedTotal: row.released_total,
    };
  } catch {
    /*
     * Susarsa ekran yine çiziliyor: "Hesabım"daki iki sayı ve kilit, sayfanın
     * açılmasını engelleyecek şeyler değil (`readMeadow` ile aynı karar).
     */
    return null;
  }
}
