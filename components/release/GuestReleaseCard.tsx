'use client';

import { Butterfly } from '@/components/Butterfly';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

/*
 * Ekran 02 — misafir salma.
 *
 * Misafir kanat rengi SEÇEMİYOR; renk sunucuda paletten rastgele çekiliyor.
 * Kart bunu bir kısıtlama gibi değil, bir bilgi gibi anlatıyor: kilitli
 * panel gri bir kelebek gösteriyor ve altında `locked` yazıyor.
 *
 * "Sign in to choose the wing colours" prototipte düz metindi; handoff'un
 * 2 numaralı değişikliği onu BUTONA çeviriyor — girişe götürüyor ve
 * girişten sonra kullanıcıyı buraya, renk seçici açık halde geri getiriyor.
 */
export function GuestReleaseCard({
  onRelease,
  onSignIn,
  onBack,
  pending,
  blocked,
}: {
  onRelease: () => void;
  onSignIn: () => void;
  onBack: () => void;
  pending?: boolean;
  /** Bugünün misafir hakkı kullanıldı. */
  blocked?: boolean;
}) {
  return (
    <Card>
      <BackLink label="back to the meadow" onClick={onBack} />

      <p className="eyebrow eyebrow--accent">guest</p>

      <div className="card-intro">
        <h2 className="card-title card-title--lead">A butterfly at random</h2>
        <p className="body-text">
          The meadow picks the wings. Guest butterflies are not named and
          cannot be followed afterwards. One a day.
        </p>
      </div>

      {/* Kilitli renk paneli */}
      <div className="panel panel-row">
        <Butterfly fore="#C9B8B1" hind="#B9A69E" width={92} height={74} />
        <div className="locked-wings">
          <p className="eyebrow">forewing · hindwing</p>
          <p className="meta meta--locked">locked</p>
        </div>
      </div>

      {/*
       * Engelli hâl "Kelebeklerim"deki dolu yuva kalıbıyla aynı: buton
       * devre dışı, altında nedenini söyleyen bir satır. Yeni bir görsel
       * dil uydurmaya gerek yok.
       */}
      <div className="action-stack">
        <Button
          size="md"
          fullWidth
          onClick={onRelease}
          disabled={pending || blocked}
        >
          {blocked ? 'One a day' : pending ? 'Letting it go…' : 'Let it go'}
        </Button>

        {blocked && (
          <p className="note note--center">
            you have let one go today · sign in to release more
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onSignIn}
        className="text-link text-link--center text-link--underline"
      >
        Sign in to choose the wing colours
      </button>
    </Card>
  );
}
