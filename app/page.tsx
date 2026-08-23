import { Garden } from '@/components/Garden';
import { guestReleaseUsed } from '@/app/actions/release';
import { readAccountFacts } from '@/lib/server/account';
import { readReleaseTotal } from '@/lib/server/counter';
import { googleConfigured } from '@/lib/server/google';
import { readMeadow, readOwnHistory, readOwnLive } from '@/lib/server/meadow';
import { resetPending } from '@/lib/server/reset';
import { readSession } from '@/lib/server/session';
import type { AccountFacts, Butterfly, Session } from '@/lib/types';

/*
 * Tek sayfa. Yasal sayfalar dışında her şey `Garden` içinde yaşıyor.
 *
 * Burası bir Server Component: oturumu, sayacı, çayırı ve kullanıcının kendi
 * listelerini okuyup `Garden`a veriyor. Hepsi İLK RENDER'da biliniyor,
 * sonradan bir effect'le sorulmuyor — sorulsaydı sayfa önce boş bir çayırla
 * çizilir, sonra kelebekler üstüne düşerdi.
 *
 * Çerez okunduğu için sayfa zaten dinamik; ayrıca `force-dynamic` demeye
 * gerek yok.
 */
export default async function Home() {
  const [session, total, guestUsed, meadow, reset] = await Promise.all([
    readSession(),
    readReleaseTotal(),
    guestReleaseUsed(),
    readMeadow(),
    resetPending(),
  ]);

  /*
   * Kişisel listeler yalnızca üye için ve ancak oturum OKUNDUKTAN sonra
   * sorulabiliyor — hesap kimliği oradan geliyor. Bu yüzden yukarıdaki
   * paralel gruba giremiyorlar.
   */
  let mine: Butterfly[] = [];
  let history: Butterfly[] = [];
  let account: AccountFacts | null = null;
  if (session.kind === 'member') {
    [mine, history, account] = await Promise.all([
      readOwnLive(session.accountId),
      readOwnHistory(session.accountId),
      readAccountFacts(session.accountId),
    ]);
  }

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

  return (
    <Garden
      initialTotal={total}
      initialSession={initialSession}
      initialGuestUsed={guestUsed}
      initialResetPending={reset}
      initialMeadow={meadow}
      initialButterflies={mine}
      initialHistory={history}
      initialAccount={account}
      googleEnabled={googleConfigured()}
    />
  );
}
