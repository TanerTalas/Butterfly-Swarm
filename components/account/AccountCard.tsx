'use client';

import { Butterfly } from '@/components/Butterfly';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Gear } from '@/components/ui/Icons';
import { SLOT_LIMIT, type Profile } from '@/lib/types';

/*
 * Ekran 09 — hesabım.
 *
 * Üç sayı kutusu var ve üçü farklı şey söylüyor: şu an kaç kelebeğin uçtuğu,
 * bugüne kadar kaç tane bıraktığın, ne zamandır burada olduğun. İlki bir
 * kapasite göstergesi, diğer ikisi hatıra.
 */
export function AccountCard({
  profile,
  flyingNow,
  releasedTotal,
  memberSince,
  onMyButterflies,
  onSettings,
  onSignOut,
  onBack,
}: {
  profile: Profile;
  flyingNow: number;
  releasedTotal: number;
  memberSince: Date;
  onMyButterflies: () => void;
  onSettings: () => void;
  onSignOut: () => void;
  onBack: () => void;
}) {
  const monthName = memberSince.toLocaleDateString('en-GB', { month: 'short' });
  const yearName = String(memberSince.getFullYear());

  return (
    <Card width={480} className="lg:gap-[26px]">
      <div className="flex justify-end">
        <BackLink label="the meadow" onClick={onBack} />
      </div>

      <div className="flex items-center gap-4">
        <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-panel">
          <Butterfly fore={profile.avatarHex} width={42} height={34} simple />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-[26px] text-ink lg:text-[30px]">
            {profile.name}
          </p>
          <p className="truncate font-mono text-[11px] tracking-[0.14em] text-faint">
            {profile.email}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Stat value={String(flyingNow)} label="flying now" />
        <Stat value={String(releasedTotal)} label="released in total" />
        <Stat value={monthName} label={'member since ' + yearName} />
      </div>

      <Button fullWidth onClick={onMyButterflies}>
        My butterflies · {flyingNow}/{SLOT_LIMIT}
      </Button>

      <Button size="md" variant="secondary" fullWidth onClick={onSettings}>
        <Gear />
        Settings
      </Button>

      <p className="text-center font-mono text-[11px] tracking-[0.14em] text-faint">
        signed in with email ·{' '}
        <button
          type="button"
          onClick={onSignOut}
          className="text-accent hover:underline"
        >
          sign out
        </button>
      </p>
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-[14px] bg-panel px-4 py-4">
      <p className="font-display text-[26px] leading-none text-ink">{value}</p>
      <p className="mt-2 font-mono text-[11px] leading-[1.4] tracking-[0.14em] text-faint">
        {label}
      </p>
    </div>
  );
}
