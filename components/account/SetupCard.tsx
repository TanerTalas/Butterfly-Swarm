'use client';

import { useState } from 'react';
import { Butterfly } from '@/components/Butterfly';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Label } from '@/components/ui/Field';
import { AVATAR_COLOURS, NAME_MAX } from '@/lib/types';

/*
 * Ekran 05 — hesap kurulumu (kayıttan sonra).
 *
 * Kimlik paneli seçimleri CANLI gösteriyor: isim yazıldıkça ve renk
 * değiştikçe üstteki önizleme değişiyor. Prototipte statik bir kartla
 * çizilmişti ama amacı bu — kullanıcı ne seçtiğini görmeli.
 */
export function SetupCard({
  email,
  onDone,
  onBack,
}: {
  email: string;
  onDone: (name: string, avatarHex: string) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>(AVATAR_COLOURS[0].hex);

  const current = AVATAR_COLOURS.find((c) => c.hex === avatar);
  const trimmed = name.trim();

  return (
    <Card>
      <BackLink label="back" onClick={onBack} />

      <div className="flex flex-col gap-3">
        <p className="eyebrow">step 2 of 2</p>
        <h2 className="font-display text-[28px] leading-tight text-ink lg:text-[32px]">
          Set up your account
        </h2>
        <p className="text-[14px] leading-[1.6] text-body-soft">
          A name and a colour. Both can be changed later.
        </p>
      </div>

      {/* Kimlik önizlemesi */}
      <div className="flex items-center gap-4 rounded-[14px] bg-panel p-5">
        <span
          className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full bg-card"
          aria-hidden
        >
          <Butterfly fore={avatar} width={38} height={31} simple />
        </span>
        <div className="min-w-0 flex flex-col gap-1">
          <p className="truncate font-display text-[22px] text-ink">
            {trimmed || 'Your name'}
          </p>
          <p className="truncate font-mono text-[11px] tracking-[0.14em] text-faint">
            {email}
          </p>
        </div>
      </div>

      {/* İsim alanında Enter'a basmak kurulumu tamamlıyor — bkz. SignInCard */}
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed.length === 0) return;
          onDone(trimmed, avatar);
        }}
      >
        <Field
          label="name"
          display
          maxLength={NAME_MAX}
          placeholder="Wren"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint={`${name.length}/${NAME_MAX}`}
          note="shown next to the butterflies you release"
        />

        <div className="flex flex-col gap-3">
          <span className="flex items-baseline justify-between gap-3">
            <Label>profile photo</Label>
            <span className="font-mono text-[11px] tracking-[0.14em] text-faint">
              {current?.name} · {avatar}
            </span>
          </span>

          <div className="flex flex-wrap gap-3">
            {AVATAR_COLOURS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setAvatar(c.hex)}
                aria-label={c.name}
                aria-pressed={c.hex === avatar}
                data-selected={c.hex === avatar}
                className="ring-choice flex h-[46px] w-[46px] items-center justify-center rounded-full bg-panel"
              >
                <Butterfly fore={c.hex} width={28} height={23} simple />
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" fullWidth disabled={trimmed.length === 0}>
          Enter the meadow
        </Button>
      </form>
    </Card>
  );
}
