'use server';

import { sendContactNotification } from '@/lib/server/email';
import {
  clientIp,
  hashIp,
  storeMessage,
  tooManyFrom,
} from '@/lib/server/contact';
import { readSession } from '@/lib/server/session';
import { humanVerified } from '@/lib/server/turnstile';
import {
  CONTACT_BODY_MAX,
  CONTACT_EMAIL_MAX,
  CONTACT_NAME_MAX,
  type ContactFailure,
} from '@/lib/types';

/*
 * ── İletişim formu (Aşama E.4) ────────────────────────────────────────────
 *
 * Gizlilik metni "verinizin kopyasını isteyin, iletişim sayfasından yazın"
 * diye söz veriyor; bu uç nokta o sözün tutulduğu yer. Bu yüzden kapanmaması
 * kolay kapanmasından önemli — bkz. `turnstile.ts`, anahtar yokken geçiriyor.
 *
 * Mesaj HEM postayla gidiyor HEM tabloya yazılıyor. Posta sağlayıcısı bir gün
 * cevap vermeyebilir ve o sırada gelen mesajın kaybolması "usually within a
 * few days" sözünü tutulamaz hâle getirir; satır, postanın yedeği.
 */

export type ContactResult = { ok: true } | { ok: false; error: ContactFailure };

export async function sendContactMessage(input: {
  name: string;
  email: string;
  body: string;
  /** Bal küpü alanı — insanlar göremiyor, botlar dolduruyor. */
  honeypot: string;
  /** Turnstile widget'ının ürettiği token; anahtar yoksa `null`. */
  token: string | null;
}): Promise<ContactResult> {
  /*
   * ⚠ Bal küpü dolu: BAŞARI dönüyor ve hiçbir şey yazılmıyor.
   *
   * Red dönseydi bot neyi düzeltmesi gerektiğini öğrenirdi — bal küpünün
   * bütün değeri fark edilmemesinde. Ekranda insanın gördüğü ekranın aynısı
   * beliriyor; farkı yalnızca posta kutusu biliyor (girişteki tek mesaj
   * kuralının aynı mantığı).
   */
  if (input.honeypot.trim().length > 0) return { ok: true };

  const name = input.name.trim();
  const email = input.email.trim();
  const body = input.body.trim();

  /*
   * Arayüz üçünü de zaten kısıtlıyor; buradaki kontrol kuralın kendisi.
   * Geçersiz girdi `network` diline düşüyor — ekranda "girdin geçersiz" diye
   * çizilmiş bir hâl yok ve arayüzden bu yola ulaşılamıyor (salmadaki aynı
   * karar, `app/actions/release.ts`).
   */
  if (name.length < 1 || name.length > CONTACT_NAME_MAX) {
    return { ok: false, error: { kind: 'network' } };
  }
  if (!email.includes('@') || email.length > CONTACT_EMAIL_MAX) {
    return { ok: false, error: { kind: 'network' } };
  }
  if (body.length < 1 || body.length > CONTACT_BODY_MAX) {
    return { ok: false, error: { kind: 'network' } };
  }

  try {
    const ip = await clientIp();
    const ipHash = hashIp(ip);

    /*
     * Kısıt bot kontrolünden ÖNCE: kendi veritabanımıza tek sorgu, Cloudflare'e
     * bir istek demek. Sel gelirse ucuz olan önce çalışsın.
     */
    if (await tooManyFrom(ipHash)) {
      return { ok: false, error: { kind: 'rate-limit' } };
    }

    if (!(await humanVerified(input.token, ip))) {
      return { ok: false, error: { kind: 'check' } };
    }

    /*
     * ⚠ Hesap ÇEREZDEN okunuyor, formdan değil. Formdaki e-posta kanıtlanmamış
     * bir iddia; bu kanıtlanmış olan.
     */
    const session = await readSession();
    const accountId = session.kind === 'guest' ? null : session.accountId;

    await storeMessage({ accountId, name, email, body, ipHash });

    /*
     * Posta satırdan SONRA ve `deliver` hiçbir zaman fırlatmıyor: gönderim
     * düşse bile mesaj duruyor ve kullanıcı "aldık" ekranını görüyor. Tersi
     * (önce posta, sonra satır) düşen bir yazmada kullanıcıya hata gösterirdi,
     * oysa mesaj çoktan gitmiş olurdu.
     */
    await sendContactNotification({
      name,
      email,
      body,
      account: session.kind === 'guest' ? null : accountId,
    });

    return { ok: true };
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
}
