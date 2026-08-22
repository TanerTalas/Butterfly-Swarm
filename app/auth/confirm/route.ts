import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/server/db';
import { consumeEmailToken } from '@/lib/server/tokens';
import { createSession } from '@/lib/server/session';

/*
 * E-posta doğrulama bağlantısının indiği yer.
 *
 * ⚠ Bu bir EKRAN DEĞİL, giriş kapısı. Site tek sayfa ve gerçek rota değişimi
 * yok (CLAUDE.md); burası hiçbir şey çizmiyor, oturumu kurup `/`'e bırakıyor.
 * Kullanıcı çayıra düşüyor ve `page.tsx` oturumu okuyup onu hesap kurulumuna
 * gönderiyor. Doğrulamayı bir karta bağlamak, sahneyi yeniden kurduracak bir
 * rota açmak demekti.
 *
 * Çerez YAZILABİLİYOR, çünkü Route Handler — Server Component'ten yapılamayan
 * tek şey buydu.
 */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const home = NextResponse.redirect(new URL('/', origin));

  const token = searchParams.get('token');
  const purpose = searchParams.get('purpose');

  /*
   * ⚠ Geçersiz, süresi geçmiş ve kullanılmış token'ın hepsi AYNI yere gidiyor:
   * sessizce ana sayfaya. "Doğrulama başarısız" diye bir ekran yok ve olmamalı
   * — geçerli bir token ile geçersiz birini ayırt eden bir cevap, elindeki
   * token'ın tutup tutmadığını deneyerek ölçmeye izin verirdi. Kullanıcı çayıra
   * düşüyor ve hâlâ giriş yapmamışsa bunu kendisi görüyor.
   */
  if (!token || purpose !== 'verify') return home;

  try {
    const accountId = await consumeEmailToken(token, 'verify');
    if (!accountId) return home;

    await query(
      'update account set email_verified_at = now() where id = $1 and email_verified_at is null',
      [accountId],
    );

    /*
     * Doğrulayan kişi doğrudan içeri alınıyor, tekrar giriş yapması istenmiyor.
     * Bağlantı bir saatlik ve tek kullanımlık; şifreyi ikinci kez sormak
     * güvenlik eklemiyor, yalnızca `VerifyCard`ın verdiği sözü ("the meadow
     * opens once you follow it") bozardı.
     */
    await createSession(accountId);
  } catch {
    // Sessizce ana sayfaya — yukarıdaki nota bak.
  }

  return home;
}
