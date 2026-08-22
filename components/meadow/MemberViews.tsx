'use client';

import { Butterfly } from '@/components/Butterfly';
import { Button } from '@/components/ui/Button';
import { expiresFrom, SLOT_LIMIT, type Profile } from '@/lib/types';

/*
 * Kartsız çayır ekranları — 06 (girişli karşılama) ve 12 (ömür bitti).
 *
 * İkisinde de kart yok, bilinçli: bunlar bir form adımı değil, bir durum
 * bildirimi. Metin doğrudan çayırın üstünde duruyor. Yerleşim karşılamayla
 * ortak (`screens.css` → `.meadow-view`).
 */

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five'] as const;

/** Ekran 06 — girişli kullanıcı çayıra bakıyor. */
export function MemberMeadow({
  flyingNow,
  onRelease,
  onMyButterflies,
}: {
  flyingNow: number;
  onRelease: () => void;
  onMyButterflies: () => void;
}) {
  const word = WORDS[Math.min(flyingNow, WORDS.length - 1)];
  const full = flyingNow >= SLOT_LIMIT;

  return (
    <div className="meadow-view">
      <p className="eyebrow">welcome</p>

      <h2 className="meadow-view-title">
        {flyingNow === 0 ? (
          <>The meadow is waiting.</>
        ) : (
          <>
            {word} of yours
            <br />
            {flyingNow === 1 ? 'is' : 'are'} out there.
          </>
        )}
      </h2>

      <p className="meadow-view-lede">
        {full
          ? 'Every slot is taken. One opens when the oldest finishes its seven days.'
          : 'Let another one go, or just watch for a while.'}
      </p>

      <div className="action-row">
        <Button disabled={full} onClick={onRelease}>
          Release a butterfly
        </Button>
        <Button variant="secondary" onClick={onMyButterflies}>
          My butterflies · {flyingNow}/{SLOT_LIMIT}
        </Button>
      </div>
    </div>
  );
}

/** Ekran 12 — bir kelebeğin yedi günü doldu. */
export function FarewellView({
  name,
  releasedAt,
  onRelease,
  onMyButterflies,
}: {
  name: string | null;
  releasedAt: Date;
  onRelease: () => void;
  onMyButterflies: () => void;
}) {
  /*
   * ⚠ Ömür BURADA HESAPLANMIYOR. Eskiden `7 * 86400000` yazıyordu ve bu,
   * `LIFESPAN_DAYS`in ikinci bir kopyasıydı: kural değişse bu ekran eski
   * süreyle bir tarih yazmaya devam ederdi.
   */
  const ended = expiresFrom(releasedAt);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

  return (
    <div className="meadow-view">
      <p className="eyebrow">
        {fmt(releasedAt)} - {fmt(ended)}
      </p>

      <h2 className="meadow-view-title meadow-view-title--farewell">
        {name ? name + "'s seven days are over." : 'Its seven days are over.'}
      </h2>

      <p className="meadow-view-lede">
        Its wings went back to the meadow. A slot is free again.
      </p>

      <div className="action-row">
        <Button size="md" onClick={onRelease}>
          Release another
        </Button>
        <Button size="md" variant="secondary" onClick={onMyButterflies}>
          My butterflies
        </Button>
      </div>
    </div>
  );
}

/*
 * Hesap rozeti — sağ üstte, sayacın üstünde.
 * İçinde YALNIZCA avatar var, isim yok (handoff bunu özellikle belirtiyor).
 * Ölçü ve zemin `shell.css` → `.account-chip`.
 */
export function AccountChip({
  profile,
  onClick,
}: {
  profile: Profile;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="my account"
      className="account-chip"
    >
      <Butterfly fore={profile.avatarHex} width={28} height={23} simple />
    </button>
  );
}
