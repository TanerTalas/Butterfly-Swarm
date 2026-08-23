import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { transaction } from '@/lib/server/db';
import { identityFromCode, googleConfigured, OAUTH_COOKIE } from '@/lib/server/google';
import { createSession } from '@/lib/server/session';

/*
 * Google'dan DÖNÜŞ kapısı.
 *
 * ⚠ Yine bir EKRAN DEĞİL (`app/auth/confirm/route.ts` deseni): oturumu kurup
 * `/`'e bırakıyor, kullanıcı çayıra düşüyor.
 *
 * ⚠ BÜTÜN BAŞARISIZLIKLAR SESSİZCE `/`'E GİDİYOR — iptal edilmiş bir akış,
 * eşleşmeyen bir `state`, düşmüş bir takas, doğrulanmamış bir adres. Ayrı bir
 * hata ekranı icat etmenin karşılığı yok: kullanıcı Google'da vazgeçtiyse
 * zaten çayıra dönmek istiyor, gerçek bir arıza ise butona tekrar basmakla
 * çözülüyor. `/auth/confirm` de aynı kuralı izliyor.
 */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const home = NextResponse.redirect(new URL('/', origin));

  const store = await cookies();

  /*
   * Çerez HER HÂLÜKÂRDA düşürülüyor — başarıda da, hatada da. İçinde tek
   * kullanımlık bir doğrulayıcı var ve akış burada bitiyor; kalması, bir
   * sonraki denemede eski bir `state` ile eşleşme ihtimali demek.
   */
  const raw = store.get(OAUTH_COOKIE)?.value;
  store.delete(OAUTH_COOKIE);

  if (!googleConfigured() || !raw) return home;

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code || !state) return home;

  try {
    const saved = JSON.parse(raw) as { state?: string; verifier?: string };

    /*
     * ⚠ CSRF kontrolü. Bu satır olmasaydı saldırgan kendi Google hesabının
     * kodunu kurbanın tarayıcısında kullandırıp onu KENDİ hesabına
     * giriş yaptırabilirdi — kurban farkında olmadan saldırganın hesabına
     * kelebek salardı.
     */
    if (!saved.state || !saved.verifier || saved.state !== state) return home;

    const identity = await identityFromCode(code, saved.verifier);
    if (!identity) return home;

    /*
     * ⚠ DOĞRULANMAMIŞ ADRESE İZİN YOK. Bütün eşleme bu alana dayanıyor:
     * Google'ın adresi doğrulamamış olması, o adresin sahibi olunduğunun
     * kanıtlanmadığı anlamına gelir ve aşağıdaki "var olan hesaba bağla"
     * adımı o durumda hesap devralmaya dönüşürdü.
     */
    if (!identity.emailVerified) return home;

    const accountId = await transaction(async (run) => {
      // 1. Daha önce bağlanmış mı — anahtar `sub`, e-posta değil.
      const bySub = await run<{ id: string }>(
        'select id from garden.account where google_sub = $1',
        [identity.sub],
      );
      if (bySub[0]) return bySub[0].id;

      /*
       * 2. Aynı adresle şifreli bir hesap var mı — VARSA BAĞLANIYOR.
       *
       * Karar bilinçli: Google'ın adresi doğrulamış olması, bizim kendi
       * doğrulama postamız kadar güçlü bir kanıt. Reddetmek hem kullanıcıyı
       * "hesabım var ama giremiyorum" durumunda bırakır hem de hesabın VAR
       * olduğunu ele verirdi — girişteki tek mesaj kuralını delen bir cevap.
       */
      const byEmail = await run<{ id: string }>(
        'select id from garden.account where lower(email) = lower($1)',
        [identity.email],
      );
      if (byEmail[0]) {
        /*
         * ⚠ `coalesce` ile doğrulama da yazılıyor: doğrulanmamış bir hesap
         * Google ile girildiğinde doğrulanmış hâle geliyor. Yan etki değil,
         * İSTENEN şey — doğrulama postası kaybolduğunda hesabın kilitlenmesi
         * (CLAUDE.md → Açık işler §1.1) bu yoldan açılıyor. Zaten doğrulanmışsa tarih
         * değişmiyor; "ne zaman üye oldun" cevabı geriye kaymamalı.
         */
        await run(
          `update garden.account
              set google_sub = $1,
                  email_verified_at = coalesce(email_verified_at, now())
            where id = $2`,
          [identity.sub, byEmail[0].id],
        );
        return byEmail[0].id;
      }

      /*
       * 3. Yeni hesap. `password_hash` NULL ve `name` NULL doğuyor.
       *
       * İsimsizlik kasıtlı: `readSession()` bu hesabı `incomplete` olarak
       * görüyor ve arayüz kurulum kartını kendiliğinden açıyor. Yani Google'la
       * gelen kullanıcı da çayır ismini ve rengini KENDİ seçiyor — bu yüzden
       * Google'dan `profile` kapsamı hiç istenmiyor.
       */
      const created = await run<{ id: string }>(
        `insert into garden.account (email, password_hash, email_verified_at, google_sub)
         values ($1, null, now(), $2)
         returning id`,
        [identity.email, identity.sub],
      );
      return created[0].id;
    });

    await createSession(accountId);
  } catch {
    /*
     * Sessizce çayıra. Buraya düşmenin gerçek bir yolu var: aynı Google
     * hesabıyla iki sekmeden aynı anda girmek, 2. adımdaki `update`i benzersiz
     * indekse çarptırabiliyor. Nadir ve tekrar denemekle geçiyor.
     */
    return home;
  }

  return home;
}
