'use server';

import { query, queryOne, transaction } from '@/lib/server/db';
import { hashPassword, verifyPassword, isPasswordAcceptable } from '@/lib/server/password';
import {
  createSession,
  destroySession,
  readSession,
} from '@/lib/server/session';
import { issueEmailToken } from '@/lib/server/tokens';
import { readOwnHistory, readOwnLive } from '@/lib/server/meadow';
import {
  sendVerificationEmail,
  sendAlreadyRegisteredEmail,
} from '@/lib/server/email';
import { attemptKey, lockedFor, recordFailure, clearFailures } from '@/lib/server/throttle';
import { NAME_MAX, AVATAR_COLOURS } from '@/lib/types';
import type { Butterfly, Profile, SignInError } from '@/lib/types';

/*
 * ── Kimlik Server Action'ları (Aşama E.1) ─────────────────────────────────
 *
 * Site TEK SAYFA ve gerçek rota değişimi yok (CLAUDE.md). Bu yüzden kimlik
 * `redirect()` ile değil, TİPLİ CEVAP döndüren action'larla yürüyor: kart
 * cevabı alıyor, `Garden` görünümü değiştiriyor, sahne hiç unmount olmuyor.
 * Bir `/login` rotası çayırı her girişte yeniden kurardı.
 *
 * ⚠ Hiçbiri istisna fırlatmıyor. Fırlatan bir Server Action istemciye
 * "an unexpected error occurred" diye geçiyor ve ekranlarda o dilin karşılığı
 * yok; red hâlleri çizili (D5/D6) ve cevap onlara oturmak zorunda.
 */

export type SignInResult =
  /**
   * ⚠ Kişisel listeler CEVABIN İÇİNDE geliyor.
   *
   * Sayfa açılırken de okunuyorlar (`app/page.tsx`) ama o an kullanıcı henüz
   * misafirdi, yani listeler boştu. Girişten sonra yeniden okunmasalardı
   * "Kelebeklerim" 0/5 gösterirdi — kelebekler veritabanında dururken.
   *
   * Sayfayı yenilemek de çözüm değildi: `Garden`ın durumu zaten kurulmuş
   * oluyor ve yeni başlangıç değerleri okunmuyor.
   */
  | {
      ok: true;
      session: 'member';
      profile: Profile;
      butterflies: Butterfly[];
      history: Butterfly[];
    }
  /** Giriş başarılı ama hesap kurulumu yapılmamış — `setup` ekranına. */
  | { ok: true; session: 'incomplete'; email: string }
  | { ok: false; error: SignInError };

export type SignUpResult =
  /** Kayıt alındı, doğrulama postası yolda (`SignInCard status="verify"`). */
  | { ok: true }
  | { ok: false; error: SignInError };

export async function signIn(
  email: string,
  password: string,
): Promise<SignInResult> {
  const key = attemptKey(email);

  try {
    const seconds = await lockedFor(key);
    if (seconds !== null) {
      return { ok: false, error: { kind: 'rate-limit', retryInSeconds: seconds } };
    }

    const account = await queryOne<{
      id: string;
      password_hash: string;
      email_verified_at: Date | null;
      name: string | null;
      avatar_hex: string | null;
      email: string;
    }>(
      `select id, password_hash, email_verified_at, name, avatar_hex, email
         from garden.account
        where lower(email) = $1`,
      [key],
    );

    /*
     * ⚠ Hesap yoksa da doğrulama ÇALIŞTIRILIYOR (`verifyPassword` null alınca
     * sahte bir özetle aynı işi yapıyor). Atlanırsa cevap belirgin biçimde daha
     * hızlı döner ve o süre farkı "bu e-posta kayıtlı mı" sorusunu yanıtlar —
     * tek mesaj kuralı ölçüm yoluyla delinmiş olurdu.
     */
    const correct = await verifyPassword(password, account?.password_hash ?? null);

    if (!account || !correct) {
      await recordFailure(key);
      return { ok: false, error: { kind: 'credentials' } };
    }

    /*
     * ⚠ Doğrulanmamış hesap da AYNI mesajı alıyor.
     *
     * "Önce e-postanı doğrula" demek doğru bilgi olurdu ama e-postanın kayıtlı
     * olduğunu ele verirdi — üstelik şifreyi bilmeyen birine. Doğrulama
     * bağlantısı zaten kutusunda; ekran ondan fazlasını söylemiyor.
     */
    if (!account.email_verified_at) {
      await recordFailure(key);
      return { ok: false, error: { kind: 'credentials' } };
    }

    await clearFailures(key);
    await createSession(account.id);

    if (!account.name || !account.avatar_hex) {
      return { ok: true, session: 'incomplete', email: account.email };
    }

    const [butterflies, history] = await Promise.all([
      readOwnLive(account.id),
      readOwnHistory(account.id),
    ]);

    return {
      ok: true,
      session: 'member',
      profile: {
        name: account.name,
        email: account.email,
        avatarHex: account.avatar_hex,
      },
      butterflies,
      history,
    };
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
}

export async function signUp(
  email: string,
  password: string,
): Promise<SignUpResult> {
  /*
   * ⚠ Şifre uzunluğu SUNUCUDA da bakılıyor. Arayüz zaten butonu kilitliyor
   * (`PASSWORD_MIN`), ama o kilit bir kolaylık; kuralın kendisi burada.
   *
   * Kısa şifre `credentials` olarak dönüyor ve bu tam oturan bir eşleşme değil
   * — ekranın dilinde "şifren kurallara uymuyor" diye bir hâl yok, çünkü
   * tasarım onu hiç çizmedi (arayüzden ulaşılamıyor). Yeni bir mesaj uydurmak
   * yerine var olan dile düşürülüyor.
   */
  if (!isPasswordAcceptable(password)) {
    return { ok: false, error: { kind: 'credentials' } };
  }

  const address = email.trim();
  const key = attemptKey(address);

  try {
    const existing = await queryOne<{ id: string }>(
      'select id from garden.account where lower(email) = $1',
      [key],
    );

    /*
     * ⚠ Zaten kayıtlı bir e-posta da BAŞARI döndürüyor.
     *
     * "Bu e-posta zaten kayıtlı" demek, girişteki tek mesaj kuralını arka
     * kapıdan delerdi: kayıt formu bir kullanıcı sayma aracına dönüşürdü.
     * Adresin gerçek sahibi denemeden haberdar olsun diye fark EKRANA değil
     * yalnızca posta kutusuna yansıyor.
     */
    if (existing) {
      await sendAlreadyRegisteredEmail(address);
      return { ok: true };
    }

    const passwordHash = await hashPassword(password);

    /*
     * Hesap ve doğrulama token'ı TEK İŞLEMDE. Ayrı yazılsalardı token yazımı
     * düştüğünde ortada doğrulanamayan bir hesap kalırdı ve o adresle bir daha
     * kaydolunamazdı — kullanıcı kendi adresine kilitlenmiş olurdu.
     */
    const token = await transaction(async (run) => {
      const rows = await run<{ id: string }>(
        'insert into garden.account (email, password_hash) values ($1, $2) returning id',
        [address, passwordHash],
      );
      return issueEmailToken(rows[0].id, 'verify', run);
    });

    await sendVerificationEmail(address, token);
    return { ok: true };
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
}

/**
 * Hesap kurulumu: isim + avatar rengi.
 *
 * Kayıt iki adım olduğu için hesap satırı isimsiz açılıyor; burası onu
 * dolduruyor ve kullanıcı ancak bundan sonra üye sayılıyor.
 */
export async function completeSetup(
  name: string,
  avatarHex: string,
): Promise<{ ok: true; profile: Profile } | { ok: false }> {
  const trimmed = name.trim();

  // Arayüz ikisini de zaten kısıtlıyor; buradaki kontrol kuralın kendisi.
  if (trimmed.length < 1 || trimmed.length > NAME_MAX) return { ok: false };
  if (!AVATAR_COLOURS.some((c) => c.hex === avatarHex)) return { ok: false };

  try {
    /*
     * ⚠ Hesap kimliği ÇEREZDEN geliyor, çağrıdan değil. İstemciden bir kimlik
     * alınsaydı, herkes başkasının profilini yeniden adlandırabilirdi.
     */
    const session = await readSession();
    if (session.kind === 'guest') return { ok: false };

    await query('update garden.account set name = $1, avatar_hex = $2 where id = $3', [
      trimmed,
      avatarHex,
      session.accountId,
    ]);

    const email =
      session.kind === 'member' ? session.profile.email : session.email;

    return { ok: true, profile: { name: trimmed, email, avatarHex } };
  } catch {
    return { ok: false };
  }
}

/**
 * Çıkış.
 *
 * ⚠ Kelebekler çayırda KALIYOR. Salınan kelebek çayırın, salanın değil —
 * oturum kapansa da yedi gününü doldurmaya devam ediyor. (`Garden.signOut()`
 * bugün listeyi boşaltıyor; o satır E.3'te kalkacak.)
 */
export async function signOut(): Promise<void> {
  await destroySession();
}
