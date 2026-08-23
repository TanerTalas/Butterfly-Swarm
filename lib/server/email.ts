import nodemailer, { type Transporter } from 'nodemailer';

/*
 * Giden posta — TEK YÜZ.
 *
 * Sağlayıcı bu dosyanın dışında hiçbir yerde geçmiyor ve BURADA DA GEÇMİYOR:
 * katman düz SMTP, konak bir ortam değişkeni. Bugün Gmail'in sunucusu
 * kullanılıyor, yarın alan adı alınırsa değişen tek şey `SMTP_*` değerleri —
 * kodun tek satırı bile değişmiyor. Bu, `lib/server/db.ts`in "sağlayıcıya ait
 * tek şey `DATABASE_URL`" yaklaşımının posta tarafındaki karşılığı.
 *
 * ⚠ SMTP, REST DEĞİL ve bu yüzden `nodemailer` bir bağımlılık olarak eklendi.
 * Daha önce Resend'in REST uç noktası tek bir `fetch` ile çağrılıyordu ve
 * bağımlılık gereksizdi; ama Resend doğrulanmış bir alan adı olmadan yalnızca
 * kendi hesap sahibine teslim ediyor (403), yani alan adı alınana kadar kayıt
 * akışı herkese kapalı kalıyordu. SMTP el sıkışması `fetch` ile yapılamıyor.
 *
 * ⚠ Yapılandırma yoksa posta KONSOLA basılıyor ve akış devam ediyor. Bilinçli:
 * kayıt ve doğrulama, hiçbir sağlayıcıya kaydolmadan uçtan uca denenebilsin.
 * Üretimde yokluğu sessiz bir hata olurdu, o yüzden orada gürültü çıkarıyor.
 */

type Mail = {
  to: string;
  subject: string;
  text: string;
};

/**
 * Bağlantıların gövdesi. Üretimde alan adı, geliştirmede dev sunucusu.
 *
 * ⚠ `||` kullanılıyor, `??` DEĞİL ve bu fark bir hataydı. `.env` dosyasında
 * boş bırakılmış bir satır (`APP_URL=`) değişkeni TANIMSIZ değil BOŞ STRING
 * yapıyor; `??` yalnızca `null`/`undefined` için devreye girdiğinden varsayılan
 * atlanıyordu ve doğrulama postasındaki bağlantı gövdesiz çıkıyordu
 * (`/auth/confirm?token=…` — tıklanacak bir adres değil).
 */
export function appUrl(): string {
  return process.env.APP_URL || 'http://localhost:3000';
}

/*
 * Taşıyıcı `globalThis`te duruyor — `lib/server/db.ts`teki `__gardenPool`
 * deseninin aynısı. Sıcak bir lambda ve hot reload aynı nesneyi kullanıyor;
 * her postada yeniden kurmanın karşılığı yok.
 */
declare global {
  // eslint-disable-next-line no-var
  var __gardenMailer: Transporter | null | undefined;
}

/**
 * SMTP taşıyıcısı, yapılandırma eksikse `null`.
 *
 * ⚠ `pool: true` KULLANILMIYOR. Havuzlanmış bir SMTP bağlantısı sunucusuz
 * çağrılar arasında yaşamıyor; açık kalan soket ise fonksiyonu ayakta tutup
 * çalışma süresini uzatıyor. Her posta kendi bağlantısını kuruyor.
 *
 * ⚠ Zaman aşımları ŞART. `deliver()` `signUp` içinde `await` ediliyor, yani
 * asılı kalan bir el sıkışması kullanıcının kayıt cevabını bekletiyor.
 * Varsayılanlar dakikalarla ölçülüyor; buradaki sınır saniyelerle.
 */
function mailer(): Transporter | null {
  if (globalThis.__gardenMailer !== undefined) return globalThis.__gardenMailer;

  // ⚠ `||`, `??` DEĞİL — yukarıdaki `appUrl()` notundaki sebeple.
  const host = process.env.SMTP_HOST || '';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';

  if (!host || !user || !pass) {
    globalThis.__gardenMailer = null;
    return null;
  }

  /*
   * 465 örtük TLS ile açılıyor, 587 düz başlayıp STARTTLS'e geçiyor. `secure`
   * bu yüzden porttan TÜRETİLİYOR: ikisini ayrı ayrı yazdırmak, birini
   * değiştirip öbürünü unutmaya açık bir kapı olurdu.
   */
  const port = Number(process.env.SMTP_PORT || '465');

  globalThis.__gardenMailer = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  return globalThis.__gardenMailer;
}

async function deliver(mail: Mail): Promise<void> {
  const transport = mailer();
  const from = process.env.MAIL_FROM;

  if (!transport || !from) {
    if (process.env.NODE_ENV === 'production') {
      /*
       * Üretimde yapılandırmasız kalmak, kaydolan herkesi hiç açılmayacak bir
       * kapının önünde bırakmak demek. Fırlatmıyoruz (çağıran akış sürmeli) ama
       * sessiz de kalmıyoruz.
       */
      console.error('[mail] SMTP_* / MAIL_FROM yok — posta GÖNDERİLMEDİ');
      return;
    }

    console.log(
      `\n──── posta (geliştirme) ────\nkime: ${mail.to}\nkonu: ${mail.subject}\n\n${mail.text}\n────────────────────────────\n`,
    );
    return;
  }

  try {
    /*
     * ⚠ `from`un adres kısmı `SMTP_USER` ile AYNI olmak zorunda. Gmail,
     * kimliği doğrulanmış hesaptan başkası adına göndermeyi kabul etmiyor:
     * farklı bir adres yazılırsa ya reddediyor ya da `From`u sessizce kendi
     * adresiyle değiştiriyor. Kural `.env.example`da da yazılı.
     */
    await transport.sendMail({
      from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    });
  } catch (error) {
    /*
     * ⚠ Fırlatmıyor. Posta gönderilememesi kayıt akışını ÇÖKERTMEMELİ: hesap
     * zaten açıldı, kullanıcı "postanı kontrol et" ekranını görüyor ve bağlantı
     * yeniden istenebilir. Fırlatsaydı Server Action hata döndürür, kullanıcı
     * hesabının açıldığını hiç öğrenemez ve aynı e-postayla tekrar denerdi.
     */
    console.error('[mail] gönderilemedi:', error);
  }
}

/**
 * E-posta doğrulama bağlantısı.
 *
 * ⚠ Bağlantının ömrü BİR SAAT ve metin bunu söylüyor, çünkü ekran da söylüyor
 * (`VerifyCard`: "the link lasts an hour"). Süre `lib/server/tokens.ts`te.
 */
export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const link = `${appUrl()}/auth/confirm?token=${token}&purpose=verify`;

  await deliver({
    to,
    subject: 'Open the meadow',
    text: [
      'Follow this link and the meadow opens:',
      '',
      link,
      '',
      'The link lasts an hour. If you did not ask for it, nothing happens —',
      'you can ignore this message.',
    ].join('\n'),
  });
}

/**
 * Şifre sıfırlama bağlantısı.
 *
 * ⚠ Ömür yine BİR SAAT ve metin bunu söylüyor, çünkü ekran da söylüyor. Süre
 * `lib/server/tokens.ts` → `TOKEN_MINUTES`; üç yer tek sayıdan besleniyor.
 *
 * Metin, isteği yapmayan birine ne olduğunu da anlatıyor: sıfırlama isteği tek
 * başına hiçbir şeyi değiştirmiyor, eski şifre bağlantı kullanılana kadar
 * çalışmaya devam ediyor.
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const link = `${appUrl()}/auth/confirm?token=${token}&purpose=reset`;

  await deliver({
    to,
    subject: 'A new password for the meadow',
    text: [
      'Follow this link to set a new password:',
      '',
      link,
      '',
      'The link lasts an hour and works once. If you did not ask for it,',
      'nothing has changed — your old password still works and you can',
      'ignore this message.',
    ].join('\n'),
  });
}

/**
 * İletişim formundan gelen mesajın BİZE gelen kopyası.
 *
 * ⚠ Gönderene otomatik cevap YOK ve olmamalı. Formdaki adres doğrulanmamış:
 * "mesajını aldık" postası, isteyen herkesin istediği adrese bizim adımıza
 * metin yollayabilmesi demekti. Kullanıcının aldığı onay ekranda kalıyor.
 *
 * ⚠ `reply_to` KULLANILMIYOR, adres gövdeye yazılıyor. Cevap yazan kişi
 * adresi görüp bilerek seçsin: doğrulanmamış bir adrese refleksle "yanıtla"
 * demek, bir başkasının hesabı hakkındaki yazışmayı yabancıya göndermek
 * olabilir.
 *
 * Gövdedeki `account` satırı ÇEREZDEN okunan hesap — formdaki e-postanın
 * aksine kanıtlanmış olan. "Verimi silin" diyen bir mesajın hangi hesaba ait
 * olduğu yalnızca oradan bilinebiliyor.
 */
export async function sendContactNotification(input: {
  name: string;
  email: string;
  body: string;
  account: string | null;
}): Promise<void> {
  /*
   * Kutu ayrı bir değişken: `MAIL_FROM` gönderen kimliği (doğrulanmış alan
   * adı) ve okunan bir kutu olmak zorunda değil. Yoksa yine de bir yere
   * düşsün diye ona geri düşülüyor.
   */
  const to = process.env.CONTACT_TO || process.env.MAIL_FROM || 'inbox@localhost';

  await deliver({
    to,
    subject: `Contact · ${input.name}`,
    text: [
      `from:    ${input.name} <${input.email}>`,
      `account: ${input.account ?? 'not signed in'}`,
      '',
      input.body,
    ].join('\n'),
  });
}

/**
 * Zaten kayıtlı bir adrese kayıt denendiğinde giden posta.
 *
 * ⚠ Bu posta girişteki TEK MESAJ kuralının parçası. Kayıt ekranı e-postanın
 * kayıtlı olduğunu söylemiyor — söyleseydi kullanıcı sayımına izin verirdi —
 * ama adresin gerçek sahibi bir denemenin olduğunu bilmeli. Fark ekranda değil,
 * yalnızca kutuda.
 */
export async function sendAlreadyRegisteredEmail(to: string): Promise<void> {
  await deliver({
    to,
    subject: 'You already have a meadow',
    text: [
      'Someone tried to sign up with this address, but it already has an',
      'account. If that was you, just sign in instead:',
      '',
      appUrl(),
      '',
      'If it was not you, nothing has changed and there is nothing to do.',
    ].join('\n'),
  });
}
