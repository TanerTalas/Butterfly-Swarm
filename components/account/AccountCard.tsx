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
    <Card width={480} className="account-card">
      <BackLink label="back to the meadow" onClick={onBack} />

      <div className="account-identity">
        <span
          className="avatar avatar--panel"
          style={{ width: 72, height: 72 }}
        >
          <Butterfly fore={profile.avatarHex} width={42} height={34} simple />
        </span>
        <div className="identity">
          <p className="account-name">{profile.name}</p>
          <p className="stamp stamp--truncate">{profile.email}</p>
        </div>
      </div>

      <div className="stat-row">
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

      <div className="center-row">
        <button
          type="button"
          onClick={onSignOut}
          className="text-link text-link--underline"
        >
          sign out
        </button>
      </div>
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}
