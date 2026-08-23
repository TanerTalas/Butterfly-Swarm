import { randomBytes, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import {
  authUrl,
  googleConfigured,
  OAUTH_COOKIE,
  OAUTH_COOKIE_MINUTES,
} from '@/lib/server/google';

/*
 * Google'a GİDİŞ kapısı.
 *
 * ⚠ Bu bir EKRAN DEĞİL — `app/auth/confirm/route.ts` ile aynı desen. Hiçbir
 * şey çizmiyor, çerezi kurup Google'a bırakıyor.
 *
 * ⚠ SAHNE BURADA BİR KEZ YENİDEN KURULUYOR. Site tek sayfa ve gerçek rota
 * değişimi yok (CLAUDE.md), ama OAuth tam sayfa gezinmesi olmadan yapılamıyor:
 * kullanıcı Google'a gidip geri dönmek zorunda. Kabul edilmiş bir bedel ve
 * `/auth/confirm`in zaten kabul ettiğinin aynısı.
 */

export async function GET(request: NextRequest) {
  const home = NextResponse.redirect(new URL('/', request.nextUrl.origin));

  // Anahtar yoksa buton zaten kapalı; adres elle yazılmışsa sessizce çayıra.
  if (!googleConfigured()) return home;

  /*
   * ⚠ İKİSİ AYRI İŞ YAPIYOR ve ikisi de gerekli.
   *
   *   state     CSRF: dönüşte gelen cevabın BİZİM başlattığımız akışa ait
   *             olduğunu kanıtlıyor. Olmasaydı saldırgan kendi Google
   *             kodunu kurbanın tarayıcısında kullandırabilirdi.
   *   verifier  PKCE: kodu ele geçiren biri (tarayıcı geçmişi, referrer,
   *             ara sunucu logu) onu takas EDEMİYOR — takas, yalnızca bu
   *             çerezde duran doğrulayıcıyla mümkün.
   */
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  const store = await cookies();
  store.set(OAUTH_COOKIE, JSON.stringify({ state, verifier }), {
    /*
     * ⚠ `httpOnly` şart: doğrulayıcı JavaScript'e açık olsaydı PKCE'nin
     * koruduğu şeyi bir XSS okuyabilirdi. `sameSite: 'lax'` de şart —
     * kullanıcı Google'dan BAŞKA BİR SİTEDEN geri dönüyor ve `strict`
     * olsaydı çerez o gezinmeye eklenmez, akış her seferinde düşerdi.
     */
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: OAUTH_COOKIE_MINUTES * 60,
  });

  return NextResponse.redirect(authUrl(state, challenge));
}
