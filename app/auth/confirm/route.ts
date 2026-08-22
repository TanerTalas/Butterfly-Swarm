import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { sessionClient } from '@/lib/supabase/server';

/*
 * E-posta doğrulama bağlantısının indiği yer.
 *
 * ⚠ Bu bir EKRAN DEĞİL, giriş kapısı. Site tek sayfa ve gerçek rota değişimi
 * yok (CLAUDE.md); burası hiçbir şey çizmiyor, çerezi yazıp `/`e bırakıyor.
 * Kullanıcı çayıra düşüyor ve `page.tsx` oturumu okuyup onu hesap kurulumuna
 * gönderiyor. Doğrulamayı bir karta bağlamak, sahneyi yeniden kurduracak bir
 * rota açmak demekti.
 *
 * Çerez YAZILABİLİYOR, çünkü Route Handler — Server Component'ten
 * yapılamayan tek şey buydu (bkz. lib/supabase/server.ts).
 */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  /*
   * Bağlantı bozuk ya da eksikse sessizce ana sayfaya.
   *
   * "Doğrulama başarısız" diye bir ekran YOK ve olmamalı: geçerli bir token
   * ile geçersiz birini ayırt eden bir mesaj, elindeki token'ın tutup
   * tutmadığını deneyerek ölçmeye izin verirdi. Kullanıcı çayıra düşüyor ve
   * hâlâ giriş yapmamışsa bunu kendisi görüyor.
   */
  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL('/', origin));
  }

  const supabase = await sessionClient();
  await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  return NextResponse.redirect(new URL('/', origin));
}
