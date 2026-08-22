/*
 * Giden posta — TEK YÜZ.
 *
 * Sağlayıcı bu dosyanın dışında hiçbir yerde geçmiyor. Bugün Resend'in REST
 * uç noktası kullanılıyor (SDK değil: tek `fetch` çağrısı için bir bağımlılık
 * daha eklemenin karşılığı yok); değişirse yalnızca `deliver` değişiyor.
 *
 * ⚠ Anahtar yoksa posta KONSOLA basılıyor ve akış devam ediyor. Bilinçli:
 * kayıt ve doğrulama, hiçbir sağlayıcıya kaydolmadan uçtan uca denenebilsin.
 * Üretimde anahtarın yokluğu sessiz bir hata olurdu, o yüzden orada gürültü
 * çıkarıyor (aşağıya bak).
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

async function deliver(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!key || !from) {
    if (process.env.NODE_ENV === 'production') {
      /*
       * Üretimde anahtarsız kalmak, kaydolan herkesi hiç açılmayacak bir kapının
       * önünde bırakmak demek. Fırlatmıyoruz (çağıran akış sürmeli) ama sessiz
       * de kalmıyoruz.
       */
      console.error('[mail] RESEND_API_KEY/MAIL_FROM yok — posta GÖNDERİLMEDİ');
      return;
    }

    console.log(
      `\n──── posta (geliştirme) ────\nkime: ${mail.to}\nkonu: ${mail.subject}\n\n${mail.text}\n────────────────────────────\n`,
    );
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
      }),
    });

    if (!response.ok) {
      console.error('[mail] gönderilemedi:', response.status);
    }
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
