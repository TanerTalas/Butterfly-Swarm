'use server';

import { readAccountFacts } from '@/lib/server/account';
import { query, queryOne } from '@/lib/server/db';
import { destroySession, readSession } from '@/lib/server/session';
import {
  AVATAR_COLOURS,
  NAME_MAX,
  PROFILE_LOCK_DAYS,
  type Profile,
} from '@/lib/types';

/*
 * ── Hesap: profil düzenleme ve silme ──────────────────────────────────────
 *
 * İkisi de `SettingsCard`ın karşılığı. Ayrı bir dosyada duruyorlar çünkü
 * `auth.ts` girişin dili (kim olduğun), burası hesabın kendisi (ne olduğu).
 *
 * ⚠ İkisinde de hesap kimliği ÇEREZDEN okunuyor, çağrıdan değil. Kimlik alan
 * bir silme uç noktası, herkesin herkesin hesabını silebilmesi demekti.
 */

export type ProfileResult =
  | { ok: true; profile: Profile; lockedUntil: Date }
  /**
   * Kilit dolmamış — kullanıcı bugün zaten bir kez kaydetmiş.
   *
   * ⚠ Kilidin BİTİŞ ANI da dönüyor. Buraya düşmenin tek yolu başka bir sekmede
   * kaydetmiş olmak, yani ekrandaki hâl gerçeğin gerisinde kalmış demek; anı
   * göndermek o ekranı kendiliğinden düzeltiyor. Tahmin edilen bir an
   * göndermek (şimdi + bir gün) kullanıcıya yanlış bir tarih söylemek olurdu.
   */
  | { ok: false; reason: 'locked'; lockedUntil: Date | null }
  | { ok: false; reason: 'network' };

/**
 * İsim ve profil rengini kaydeder, ardından bir günlük kilidi başlatır.
 *
 * ⚠ Kilit SUNUCUDA. İstemcide tutulduğu sürece yenilemek onu sıfırlıyordu,
 * yani ekrandaki not ("cannot be changed again for 1 day") tutulmayan bir
 * sözdü.
 *
 * ⚠ Kaç gün olduğu burada YAZILI DEĞİL: `PROFILE_LOCK_DAYS` (lib/types.ts) —
 * kartın notunu yazan sayının aynısı. İkinci bir kopya, ikisinden birinin
 * sessizce yalan söylemesi demek.
 */
export async function updateProfile(
  name: string,
  avatarHex: string,
): Promise<ProfileResult> {
  const trimmed = name.trim();

  // Arayüz ikisini de zaten kısıtlıyor; buradaki kontrol kuralın kendisi.
  if (trimmed.length < 1 || trimmed.length > NAME_MAX) {
    return { ok: false, reason: 'network' };
  }
  if (!AVATAR_COLOURS.some((c) => c.hex === avatarHex)) {
    return { ok: false, reason: 'network' };
  }

  try {
    const session = await readSession();
    if (session.kind !== 'member') return { ok: false, reason: 'network' };

    const lockedUntil = new Date(
      Date.now() + PROFILE_LOCK_DAYS * 86_400_000,
    );

    /*
     * Kilit kontrolü SORGUNUN İÇİNDE: önce okuyup sonra yazsaydık, iki sekmeden
     * gelen iki kaydetme arasında kilit hiç görünmeden geçebilirdi. Satır
     * dönmediyse kilit hâlâ duruyor demek.
     */
    const row = await queryOne<{ id: string }>(
      `update garden.account
          set name = $1, avatar_hex = $2, profile_locked_until = $3
        where id = $4
          and (profile_locked_until is null or profile_locked_until <= now())
      returning id`,
      [trimmed, avatarHex, lockedUntil, session.accountId],
    );

    if (!row) {
      const facts = await readAccountFacts(session.accountId);
      return { ok: false, reason: 'locked', lockedUntil: facts?.lockedUntil ?? null };
    }

    return {
      ok: true,
      profile: { name: trimmed, email: session.profile.email, avatarHex },
      lockedUntil,
    };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/**
 * Hesabı ve ona bağlı her şeyi siler.
 *
 * ⚠ KALICI, geri alma penceresi YOK. Arayüz üç yerde birden söz veriyor
 * (ayarlardaki not, "Delete for good" etiketi, gizlilik metnindeki "at once")
 * ve bu fonksiyon o sözün kendisi.
 *
 * ⚠ ŞİFRE SORULMUYOR ve bu karar verilmiş bir şey (CLAUDE.md). Onay eşiği
 * hesap adını yazmak; bedeli açıkça kabul edildi — çalınmış bir oturumla hesap
 * silinebiliyor. "Eksik" diye yeniden gündeme getirilecek bir şey değil.
 *
 * Kelebekler, oturumlar ve token'lar `on delete cascade` ile gidiyor: kelebek
 * satırı silinince çayır sorgusu onu bir daha görmüyor, yani kelebekler
 * gerçekten ANINDA kalkıyor. İletişim mesajları `on delete set null` ile
 * duruyor ama artık kimseye bağlı değil — cevaplanmamış bir soru silinmesin
 * diye (bkz. `0002_contact.sql`).
 */
export async function deleteAccount(): Promise<{ ok: boolean }> {
  try {
    const session = await readSession();
    if (session.kind === 'guest') return { ok: false };

    await query('delete from garden.account where id = $1', [
      session.accountId,
    ]);

    /*
     * Çerez ayrıca düşürülüyor. Oturum SATIRI zaten cascade ile gitti — yani
     * "bütün oturumlar sonlanıyor" sözü tutuldu, `destroyAllSessions`a gerek
     * yok — ama bu tarayıcıda duran çerez, artık hiçbir şeye açılmayan bir
     * anahtar olarak kalırdı.
     */
    await destroySession();

    return { ok: true };
  } catch {
    return { ok: false };
  }
}
