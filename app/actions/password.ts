'use server';

import { query, queryOne } from '@/lib/server/db';
import { hashPassword, isPasswordAcceptable } from '@/lib/server/password';
import { createSession, destroyAllSessions } from '@/lib/server/session';
import {
  consumeEmailToken,
  issueEmailToken,
  lastTokenIssuedAt,
} from '@/lib/server/tokens';
import { sendPasswordResetEmail } from '@/lib/server/email';
import { attemptKey } from '@/lib/server/throttle';
import { clearResetCookie, readResetToken } from '@/lib/server/reset';

/*
 * ── Şifre sıfırlama ───────────────────────────────────────────────────────
 *
 * Şifresini unutan kullanıcının tek çıkışı. Ayarlarda şifre formu YOK ve
 * olmayacak: giriş yapmış biri de şifresini değiştirmek isterse önce çıkış
 * yapıp buradan geçiyor.
 */

/** Art arda posta istemeye karşı en kısa aralık. */
const RESEND_COOLDOWN_MINUTES = 2;

/**
 * Sıfırlama postası ister.
 *
 * ⚠ HER ZAMAN başarı döndürüyor.
 *
 * Kayıtlı olmayan bir adres için de aynı cevap ve aynı ekran. Aksi hâlde bu
 * form bir kullanıcı sayma aracına dönüşürdü: adresi yazıp cevaba bakmak,
 * "bu kişinin hesabı var mı" sorusunu yanıtlardı. Girişteki tek mesaj
 * kuralının (CLAUDE.md) aynısı — fark yalnızca posta kutusunda.
 */
export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  try {
    const address = email.trim();
    const key = attemptKey(address);

    const account = await queryOne<{ id: string; email: string }>(
      `select id, email
         from garden.account
        where lower(email) = $1
          and email_verified_at is not null`,
      [key],
    );

    /*
     * Doğrulanmamış hesap da buraya düşüyor ve postasız kalıyor. Bilinçli:
     * doğrulanmamış bir adresin sahibi olduğu kanıtlanmadı, oraya sıfırlama
     * bağlantısı yollamak o kanıtı atlamak olurdu. O kullanıcının elinde
     * zaten bir doğrulama bağlantısı var.
     */
    if (account) {
      const last = await lastTokenIssuedAt(account.id, 'reset');
      const tooSoon =
        last !== null &&
        Date.now() - last.getTime() < RESEND_COOLDOWN_MINUTES * 60_000;

      if (!tooSoon) {
        const token = await issueEmailToken(account.id, 'reset');
        await sendPasswordResetEmail(account.email, token);
      }
    }

    return { ok: true };
  } catch {
    /*
     * Hata da BAŞARI gibi görünüyor. Ekranda "sıfırlama isteği gönderilemedi"
     * diye bir hâl yok ve olması, var olmayan adresle var olan adresi ayırt
     * eden ikinci bir kanal açardı.
     */
    return { ok: true };
  }
}

export type ResetResult =
  | { ok: true }
  /** Bağlantı ölmüş (süresi geçmiş, kullanılmış ya da çerez düşmüş). */
  | { ok: false; reason: 'link' }
  /** Şifre kurallara uymuyor. */
  | { ok: false; reason: 'password' };

/**
 * Yeni şifreyi kurar.
 *
 * Token ÇEREZDEN okunuyor, çağrıdan değil: istemciden bir token alınsaydı,
 * onu ele geçiren herkes başkasının şifresini değiştirebilirdi.
 */
export async function resetPassword(newPassword: string): Promise<ResetResult> {
  if (!isPasswordAcceptable(newPassword)) {
    return { ok: false, reason: 'password' };
  }

  try {
    const token = await readResetToken();
    if (!token) return { ok: false, reason: 'link' };

    /*
     * Tüketme ile doğrulama TEK sorguda (`consumeEmailToken`). Aynı bağlantı
     * iki sekmede açıksa ikisi de geçerli görmesin.
     */
    const accountId = await consumeEmailToken(token, 'reset');
    if (!accountId) {
      await clearResetCookie();
      return { ok: false, reason: 'link' };
    }

    const passwordHash = await hashPassword(newPassword);
    await query('update garden.account set password_hash = $1 where id = $2', [
      passwordHash,
      accountId,
    ]);

    /*
     * ⚠ ŞİFRE DEĞİŞTİ, ESKİ OTURUMLARIN HEPSİ DÜŞÜYOR.
     *
     * Sıfırlamanın asıl sebebi çoğu zaman "hesabıma başkası girdi" oluyor;
     * o kişinin oturumu ayakta kalırsa şifreyi değiştirmenin bir anlamı
     * kalmaz. Opak token + veritabanı satırı seçilmesinin sebebi tam olarak
     * buydu (CLAUDE.md → Kimlik): imzalı bir JWT geri alınamazdı.
     */
    await destroyAllSessions(accountId);

    // Kullanıcı içeri alınıyor: bağlantı tek kullanımlık ve bir saatlik,
    // şifreyi ikinci kez sormak güvenlik eklemiyor.
    await createSession(accountId);
    await clearResetCookie();

    return { ok: true };
  } catch {
    return { ok: false, reason: 'link' };
  }
}
