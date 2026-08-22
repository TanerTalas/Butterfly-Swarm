import { cookies } from 'next/headers';

/*
 * Şifre sıfırlama token'ını taşıyan çerez.
 *
 * ⚠ BU DOSYA BİLİNÇLİ OLARAK `'use server'` DEĞİL.
 *
 * `'use server'` bir dosyadaki HER export'u tarayıcıdan çağrılabilir bir uç
 * noktaya çeviriyor. `setResetCookie` orada dursaydı, herkes kendi seçtiği bir
 * değeri sıfırlama çerezine yazdırabilirdi. Tek başına sömürülebilir değil
 * (token yine de veritabanında doğrulanıyor), ama açılmasına hiç gerek olmayan
 * bir kapı. Buradaki fonksiyonlar yalnızca sunucu içinden çağrılıyor.
 *
 * ⚠ Token sayfanın ADRESİNE konmuyor, çereze yazılıyor. Adres çubuğuna yazılan
 * bir token tarayıcı geçmişine, referrer başlığına ve omuz üstünden bakan
 * herkese açık olurdu; çerez `httpOnly` olduğu için JavaScript de göremiyor.
 * Projenin "token hiç DOM'a girmiyor" kararının devamı (CLAUDE.md → Kimlik).
 */

const RESET_COOKIE = 'garden_reset';

/**
 * Çerezin ömrü — token'ınkinden (1 saat) KISA.
 *
 * Bağlantıya tıklandıktan sonra form doldurmak için makul bir süre; daha uzun
 * tutmak, ortak bir bilgisayarda açık kalan bir sekmeyi sonraki kişiye şifre
 * değiştirme yetkisi vermek olurdu.
 */
const RESET_COOKIE_MINUTES = 15;

export async function setResetCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(RESET_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: RESET_COOKIE_MINUTES * 60,
  });
}

export async function readResetToken(): Promise<string | null> {
  return (await cookies()).get(RESET_COOKIE)?.value ?? null;
}

export async function clearResetCookie(): Promise<void> {
  (await cookies()).delete(RESET_COOKIE);
}

/** Sıfırlama ekranı açılmalı mı — `app/page.tsx` soruyor. */
export async function resetPending(): Promise<boolean> {
  return (await readResetToken()) !== null;
}
