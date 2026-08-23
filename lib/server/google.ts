import { appUrl } from '@/lib/server/email';

/*
 * Google ile giriş — OAuth 2.0 / OIDC yetkilendirme kodu akışı.
 *
 * ⚠ BU DOSYA BİLİNÇLİ OLARAK `'use server'` DEĞİL — `lib/server/reset.ts`teki
 * sebeple aynı: `'use server'` bir dosyadaki HER export'u tarayıcıdan
 * çağrılabilir bir uç noktaya çeviriyor. Buradaki fonksiyonlar gizli anahtarla
 * konuşuyor ve yalnızca Route Handler içinden çağrılıyor.
 *
 * Kütüphane kullanılmadı: akışın tamamı iki yönlendirme ve bir `fetch`. Hazır
 * bir kimlik kütüphanesi (NextAuth vb.) kendi oturum modelini de getirirdi ve
 * bizim oturumumuz zaten var — opak token + veritabanı satırı, iptal
 * edilebilir olsun diye (CLAUDE.md → Kimlik).
 */

/**
 * `state` ve PKCE doğrulayıcısını taşıyan kısa ömürlü çerez.
 *
 * Adı BURADA duruyor, rota dosyasında değil: `route.ts`ten HTTP metodu
 * dışında bir şey export etmek Next'in rota doğrulamasına takılıyor ve iki
 * kapının (gidiş/dönüş) aynı adı görmesi şart.
 */
export const OAUTH_COOKIE = 'garden_oauth';

/**
 * Çerezin ömrü.
 *
 * Google'da hesap seçip izin vermek için makul bir süre. Uzun tutmanın
 * karşılığı yok: yarım kalmış bir akışın açık bıraktığı tek şey bu çerez.
 */
export const OAUTH_COOKIE_MINUTES = 10;

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/** `iss` bu ikisinden biri olabiliyor; Google ikisini de kullanıyor. */
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/**
 * Dönüş adresi.
 *
 * ⚠ Google Console'daki "Authorized redirect URI" ile HARFİ HARFİNE aynı olmak
 * zorunda — sondaki eğik çizgi bile fark ediyor. Adres `appUrl()`ten geliyor
 * (`lib/server/email.ts`), yani alan adının ikinci bir kopyası yok.
 */
export function redirectUri(): string {
  return `${appUrl()}/auth/google/callback`;
}

/**
 * İki anahtar da var mı.
 *
 * ⚠ Yokken buton KAPALI kalıyor ve bu, Turnstile'ın TERSİ bir karar: orada
 * anahtarsızlık kapıyı açık bırakıyor (iletişim formunun kapanması korumasız
 * kalmasından ağır), burada kapatıyor. Sebep basit — Google'a gidip hata
 * ekranıyla dönen bir buton, kilitli duran bir butondan kötü.
 */
export function googleConfigured(): boolean {
  // ⚠ `||`, `??` DEĞİL: `.env`de boş bırakılan satır BOŞ STRING üretiyor.
  return Boolean((process.env.GOOGLE_CLIENT_ID || '') && (process.env.GOOGLE_CLIENT_SECRET || ''));
}

/** Kullanıcının gönderileceği Google adresi. */
export function authUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri(),
    response_type: 'code',

    /*
     * ⚠ YALNIZCA `openid email`. `profile` İSTENMİYOR ve istenmemeli: isim ve
     * renk çayırın kendi kurulum ekranında seçiliyor, Google'ın adını
     * kullanmıyoruz. İstemediğimiz bir veriyi izin ekranında istemek, hem
     * kullanıcıya hem gizlilik metnine fazladan bir şey söyletmek olurdu.
     */
    scope: 'openid email',

    /*
     * Hesap seçtiriyor. Olmasaydı tarayıcıda tek Google oturumu açık olan
     * kullanıcı hiçbir şey seçmeden içeri düşerdi — "hangi hesapla girdim"
     * sorusu cevapsız kalırdı.
     */
    prompt: 'select_account',

    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${AUTH_ENDPOINT}?${params}`;
}

/**
 * Yetkilendirme kodunu `id_token` ile takas eder.
 *
 * Sunucudan sunucuya, gizli anahtarla. Kod tarayıcıdan geldi ama tek başına
 * işe yaramıyor: PKCE doğrulayıcısı olmadan takas edilemiyor.
 */
async function exchangeCode(code: string, verifier: string): Promise<string | null> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    console.error('[google] kod takas edilemedi:', response.status);
    return null;
  }

  const body = (await response.json()) as { id_token?: string };
  return body.id_token ?? null;
}

export type GoogleIdentity = {
  /** Google tarafındaki sabit kimlik. Hesap satırının anahtarı bu. */
  sub: string;
  email: string;
  emailVerified: boolean;
};

/**
 * `id_token`in gövdesini okur.
 *
 * ⚠ İMZA DOĞRULANMIYOR VE BU BİR EKSİKLİK DEĞİL.
 *
 * Token tarayıcıdan gelmiyor: yukarıdaki `exchangeCode`, Google'ın kendi
 * token uç noktasına TLS üstünden sunucudan sunucuya bağlanıp onu doğrudan
 * alıyor. Google'ın dokümanı bu durumda imza doğrulamasının atlanabileceğini
 * açıkça yazıyor — araya girip token'ı değiştirebilecek bir taraf yok.
 * Doğrulamak, JWKS indirip RS256 kontrolü yapan bir JWT bağımlılığı (`jose`)
 * demekti ve karşılığı yok.
 *
 * `aud` ve `iss` yine de KONTROL EDİLİYOR: ikisi de imzadan bağımsız, ucuz ve
 * "başka bir uygulama için üretilmiş bir token" ihtimalini kapatıyor.
 */
function readIdentity(idToken: string): GoogleIdentity | null {
  const payload = idToken.split('.')[1];
  if (!payload) return null;

  let claims: {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    aud?: string;
    iss?: string;
  };

  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (claims.aud !== (process.env.GOOGLE_CLIENT_ID || '')) return null;
  if (!claims.iss || !ISSUERS.includes(claims.iss)) return null;
  if (!claims.sub || !claims.email) return null;

  return {
    sub: claims.sub,
    email: claims.email,
    // Google bu alanı bazen dize olarak veriyor.
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
  };
}

/** Kodu kimliğe çevirir. Her başarısızlık `null` — çağıran taraf ayırt etmiyor. */
export async function identityFromCode(
  code: string,
  verifier: string,
): Promise<GoogleIdentity | null> {
  const idToken = await exchangeCode(code, verifier);
  return idToken ? readIdentity(idToken) : null;
}
