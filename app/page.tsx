import { Garden } from '@/components/Garden';
import { readReleaseTotal } from '@/lib/server/counter';
import { readSession } from '@/lib/server/session';
import type { Session } from '@/lib/types';

/*
 * Tek sayfa. Yasal sayfalar dışında her şey `Garden` içinde yaşıyor.
 *
 * Burası artık bir Server Component: oturumu ve sayacı okuyup `Garden`a
 * veriyor. İkisi de İLK RENDER'da biliniyor, sonradan bir effect'le
 * sorulmuyor — sorulsaydı sayfa önce misafir hâlinde ve sıfır sayaçla
 * çizilir, sonra gerçek değerlere sıçrardı.
 *
 * Çerez okunduğu için sayfa zaten dinamik; ayrıca `force-dynamic` demeye
 * gerek yok.
 */
export default async function Home() {
  const [session, total] = await Promise.all([readSession(), readReleaseTotal()]);

  /*
   * ⚠ `accountId` İSTEMCİYE GEÇMİYOR.
   *
   * `readSession()` onu döndürüyor çünkü sunucu tarafındaki yazmalar ona
   * dayanıyor, ama tarayıcının bilmesi gereken bir şey değil ve prop olarak
   * verilseydi sayfa kaynağına gömülürdü. Yetki her hâlükârda çerezden
   * okunuyor (`completeSetup`a bak), yani istemcideki bir kimlik hiçbir işe
   * yaramaz — ama sızdırmamak da bedava.
   */
  const initialSession: Session =
    session.kind === 'member'
      ? { kind: 'member', profile: session.profile }
      : session.kind === 'incomplete'
        ? { kind: 'incomplete', email: session.email }
        : { kind: 'guest' };

  /*
   * Sayacın 27'lik tohumu artık VERİTABANINDA (`db/migrations/0001_schema.sql`).
   * Burada durduğu sürece her sekme kendi 27'sinden başlıyordu ve sayaç küresel
   * bir toplam olmaktan çıkıyordu.
   */
  return <Garden initialTotal={total} initialSession={initialSession} />;
}
