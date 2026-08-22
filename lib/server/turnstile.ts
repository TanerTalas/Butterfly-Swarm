/*
 * Cloudflare Turnstile — bot kontrolü.
 *
 * Sağlayıcı bu dosyanın dışında geçmiyor (posta için `email.ts` neyse bu da o).
 * İstemci tarafı bir widget çiziyor ve bir token üretiyor; burada o token'ın
 * gerçekten Cloudflare'den geldiği soruluyor. Token'ı DOĞRULAMADAN kabul etmek
 * hiç sormamakla aynı şey — widget istemcide, istemci de kullanıcının elinde.
 *
 * ⚠ GİZLİ ANAHTAR yalnızca burada. Widget'ın site anahtarı ayrı bir değer ve
 * açık olması sorun değil; ikisi karıştırılırsa doğrulama sahtelenebilir hâle
 * gelir.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Token'ı doğrular. `true` = geç, `false` = bot.
 *
 * ⚠ ANAHTAR YOKKEN GEÇİRİYOR ve bu bilinçli bir tercih, unutulmuş bir kontrol
 * değil. Anahtarsız kalmanın iki olası davranışı var:
 *
 *   geçirmemek → iletişim formu BÜTÜNÜYLE çalışmaz. Gizlilik metni "verinizin
 *                kopyasını isteyin, iletişim sayfasından yazın" diye söz
 *                veriyor; o sayfayı kapatmak tutulamayan bir söz demek.
 *   geçirmek   → bot koruması yok, ama IP başına saatlik kısıt (`contact.ts`)
 *                ayakta ve mesajlar bir tabloya yazılıyor: sel gelirse
 *                temizlenebilir bir şey.
 *
 * İkincisi geri alınabilir, birincisi değil. Aynı sebeple Cloudflare'e
 * ULAŞILAMADIĞINDA da geçiyor: kesinti bizim kapımızı kapatmamalı.
 *
 * Üretimde ikisi de sessiz kalmıyor — anahtarsız bir dağıtım bir hata ve
 * loglarda öyle görünüyor.
 */
export async function humanVerified(
  token: string | null,
  ip: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[turnstile] TURNSTILE_SECRET_KEY yok — bot kontrolü YAPILMADI');
    }
    return true;
  }

  // Anahtar VARSA token zorunlu: widget'ı hiç çalıştırmadan gönderen bir bot,
  // boş token'la geçmemeli.
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    /*
     * `remoteip` opsiyonel ve Cloudflare "gönderiyorsan doğru gönder" diyor:
     * vekil zincirinden okunan yanlış bir adres, geçerli bir token'ı
     * reddettirebiliyor. Adres bilinmiyorsa alan hiç eklenmiyor.
     */
    if (ip) body.set('remoteip', ip);

    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      console.error('[turnstile] doğrulanamadı:', response.status);
      return true;
    }

    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    console.error('[turnstile] doğrulanamadı:', error);
    return true;
  }
}
