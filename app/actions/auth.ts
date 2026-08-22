'use server';

import { sessionClient } from '@/lib/supabase/server';
import { readSession } from '@/lib/server/session';
import { PASSWORD_MIN, NAME_MAX, AVATAR_COLOURS } from '@/lib/types';
import type { Profile, SignInError } from '@/lib/types';

/*
 * ── Kimlik Server Action'ları (Aşama E.1) ─────────────────────────────────
 *
 * Site TEK SAYFA ve gerçek rota değişimi yok (CLAUDE.md). Bu yüzden kimlik
 * `redirect()` ile değil, TİPLİ CEVAP döndüren action'larla yürüyor: kart
 * cevabı alıyor, `Garden` görünümü değiştiriyor, sahne hiç unmount olmuyor.
 * Bir `/login` rotası çayırı her girişte yeniden kurardı.
 *
 * ⚠ Hiçbiri istisna fırlatmıyor. Fırlatan bir Server Action istemciye
 * "an unexpected error occurred" diye geçiyor ve ekranlarda o dilin karşılığı
 * yok; dört red hâli çizili (D5/D6) ve cevap onlara oturmak zorunda.
 */

export type SignInResult =
  | { ok: true; session: 'member'; profile: Profile }
  /** Giriş başarılı ama hesap kurulumu yapılmamış — `setup` ekranına. */
  | { ok: true; session: 'incomplete'; email: string }
  | { ok: false; error: SignInError };

export type SignUpResult =
  /** Kayıt alındı, doğrulama postası yolda (`SignInCard status="verify"`). */
  | { ok: true }
  | { ok: false; error: SignInError };

/*
 * Supabase hatasını ekranın bildiği dile çevirir.
 *
 * ⚠ `credentials` TEK bir mesaja karşılık geliyor: "email or password is
 * wrong". Hangi alanın yanlış olduğu SÖYLENMİYOR — söylenirse e-postanın
 * kayıtlı olup olmadığı ele verilir ve kullanıcı sayımına izin verilmiş olur.
 * Supabase de zaten iki durumu ayırmıyor; bu çeviri o davranışı koruyor.
 */
function toSignInError(status: number | undefined): SignInError {
  if (status === 429) return { kind: 'rate-limit' };
  if (status === 400 || status === 401) return { kind: 'credentials' };
  return { kind: 'network' };
}

export async function signIn(
  email: string,
  password: string,
): Promise<SignInResult> {
  try {
    const supabase = await sessionClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) return { ok: false, error: toSignInError(error.status) };

    /*
     * Profili action'ın kendisi okumuyor, `readSession()` okuyor. İkinci bir
     * okuma yolu açılsaydı "profil eksik" kuralının iki kopyası olurdu ve
     * biri güncellenmeden kalabilirdi.
     */
    const session = await readSession();

    if (session.kind === 'member') {
      return { ok: true, session: 'member', profile: session.profile };
    }
    if (session.kind === 'incomplete') {
      return { ok: true, session: 'incomplete', email: session.email };
    }

    // Giriş başarılı görünüp oturum okunamadı: çerez yazılamamış demek.
    return { ok: false, error: { kind: 'network' } };
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
}

export async function signUp(
  email: string,
  password: string,
): Promise<SignUpResult> {
  /*
   * ⚠ Şifre uzunluğu SUNUCUDA da bakılıyor. Arayüz zaten butonu kilitliyor
   * (`PASSWORD_MIN`), ama o kilit bir kolaylık; kuralın kendisi burada.
   *
   * Kısa şifre `credentials` olarak dönüyor ve bu tam doğru bir eşleşme
   * değil — ekranın dilinde "şifren kurallara uymuyor" diye bir hâl yok,
   * çünkü tasarım o hâli hiç çizmedi (arayüzden ulaşılamıyor). Yeni bir
   * mesaj uydurmak yerine var olan dile düşürülüyor.
   */
  if (password.length < PASSWORD_MIN) {
    return { ok: false, error: { kind: 'credentials' } };
  }

  try {
    const supabase = await sessionClient();

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) return { ok: false, error: toSignInError(error.status) };

    /*
     * ⚠ Zaten kayıtlı bir e-posta için de BURAYA düşülüyor.
     *
     * Supabase, e-posta doğrulaması açıkken var olan bir adres için hata
     * döndürmüyor; sahte bir başarı dönüp postayı göndermiyor. Bilinçli ve
     * bizim de istediğimiz davranış: "bu e-posta zaten kayıtlı" demek,
     * girişteki tek mesaj kuralını arka kapıdan delerdi.
     *
     * Sonuç: kayıt ekranı her hâlükârda "postanı kontrol et" diyor.
     */
    return { ok: true };
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
}

/**
 * Hesap kurulumu: isim + avatar rengi.
 *
 * Kayıt iki adım olduğu için profil satırı boş açılıyor (`profiles.name` NULL,
 * trigger'la); burası onu dolduruyor ve kullanıcı ancak bundan sonra üye
 * sayılıyor.
 */
export async function completeSetup(
  name: string,
  avatarHex: string,
): Promise<{ ok: true; profile: Profile } | { ok: false }> {
  const trimmed = name.trim();

  // Arayüz ikisini de zaten kısıtlıyor; buradaki kontrol kuralın kendisi.
  if (trimmed.length < 1 || trimmed.length > NAME_MAX) return { ok: false };
  if (!AVATAR_COLOURS.some((c) => c.hex === avatarHex)) return { ok: false };

  try {
    const supabase = await sessionClient();

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { ok: false };

    /*
     * `sessionClient` ile yazılıyor: RLS'in `profiles_update_own` politikası
     * `id`yi zaten kullanıcıya bağlıyor, yani yanlış satırı güncellemek
     * mümkün değil. Servis anahtarıyla yazılsaydı o güvence kodun dikkatine
     * kalırdı.
     */
    const { error } = await supabase
      .from('profiles')
      .update({ name: trimmed, avatar_hex: avatarHex })
      .eq('id', user.user.id);

    if (error) return { ok: false };

    return {
      ok: true,
      profile: {
        name: trimmed,
        email: user.user.email ?? '',
        avatarHex: avatarHex,
      },
    };
  } catch {
    return { ok: false };
  }
}

/**
 * Çıkış.
 *
 * ⚠ Kelebekler çayırda KALIYOR. Salınan kelebek çayırın, salanın değil —
 * oturum kapansa da yedi gününü doldurmaya devam ediyor. (Sunucusuz sürümde
 * liste bellekte olduğu için çıkışta kalkıyorlardı; o satır E.3'te
 * `Garden.signOut()` içinden kalkacak.)
 */
export async function signOut(): Promise<void> {
  try {
    const supabase = await sessionClient();
    await supabase.auth.signOut();
  } catch {
    /*
     * Çıkış SESSİZCE başarısız olabilir ve bu kabul edilebilir: çağıran taraf
     * yerel durumu her hâlükârda temizliyor. Ekranda "çıkış yapılamadı" diye
     * bir hâl yok ve olması da gerekmiyor — kullanıcı çıkmak istedi, arayüz
     * çıkmış gibi davranıyor, çerez en geç süresi dolunca gidiyor.
     */
  }
}
