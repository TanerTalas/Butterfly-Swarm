import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/server/db';
import { consumeEmailToken, emailTokenValid } from '@/lib/server/tokens';
import { createSession } from '@/lib/server/session';
import { setResetCookie } from '@/lib/server/reset';

/*
 * E-posta bağlantılarının indiği yer — doğrulama ve şifre sıfırlama.
 *
 * ⚠ Bu bir EKRAN DEĞİL, giriş kapısı. Site tek sayfa ve gerçek rota değişimi
 * yok (CLAUDE.md); burası hiçbir şey çizmiyor, çerezi kurup `/`'e bırakıyor ve
 * kullanıcı çayıra düşüyor. Bağlantıyı bir karta bağlamak, sahneyi yeniden
 * kurduracak bir rota açmak demekti.
 *
 * Çerez YAZILABİLİYOR, çünkü Route Handler — Server Component'ten yapılamayan
 * tek şey buydu.
 *
 * ⚠ Geçersiz, süresi geçmiş ve kullanılmış token'ın hepsi AYNI yere gidiyor:
 * sessizce ana sayfaya. "Bağlantı geçersiz" diye bir ekran yok ve olmamalı —
 * geçerli bir token ile geçersiz birini ayırt eden bir cevap, elindeki
 * token'ın tutup tutmadığını deneyerek ölçmeye izin verirdi.
 */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const home = NextResponse.redirect(new URL('/', origin));

  const token = searchParams.get('token');
  const purpose = searchParams.get('purpose');

  if (!token) return home;

  try {
    if (purpose === 'verify') {
      const accountId = await consumeEmailToken(token, 'verify');
      if (!accountId) return home;

      await query(
        'update garden.account set email_verified_at = now() where id = $1 and email_verified_at is null',
        [accountId],
      );

      /*
       * Doğrulayan kişi doğrudan içeri alınıyor, tekrar giriş yapması
       * istenmiyor. Bağlantı bir saatlik ve tek kullanımlık; şifreyi ikinci kez
       * sormak güvenlik eklemiyor, yalnızca `VerifyCard`ın verdiği sözü ("the
       * meadow opens once you follow it") bozardı.
       */
      await createSession(accountId);
      return home;
    }

    if (purpose === 'reset') {
      /*
       * ⚠ Token burada TÜKETİLMİYOR, yalnızca bakılıyor.
       *
       * Tıklamak bağlantıyı yakmamalı: formu doldurmadan vazgeçen ya da sekmesi
       * kapanan kullanıcı, kendi bağlantısını harcamış olur ve baştan istemek
       * zorunda kalırdı. Harcanma `resetPassword`ta, yeni şifre gönderildiğinde.
       */
      if (!(await emailTokenValid(token, 'reset'))) return home;

      /*
       * Token çereze yazılıyor, adrese DEĞİL. Adres çubuğundaki bir token
       * tarayıcı geçmişine, referrer başlığına ve omuz üstünden bakan herkese
       * açık olurdu.
       */
      await setResetCookie(token);
      return home;
    }
  } catch {
    // Sessizce ana sayfaya — yukarıdaki nota bak.
  }

  return home;
}
