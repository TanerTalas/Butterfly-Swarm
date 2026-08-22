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

      <div className="card-intro">
        <p className="eyebrow">step 2 of 2</p>
        <h2 className="card-title card-title--lead">Set up your account</h2>
        <p className="body-text">
          A name and a colour. Both can be changed later.
        </p>
      </div>

      {/* Kimlik önizlemesi */}
      <div className="panel panel-row">
        <span className="avatar" style={{ width: 68, height: 68 }} aria-hidden>
          <Butterfly fore={avatar} width={38} height={31} simple />
        </span>
        <div className="identity">
          <p className="identity-name">{trimmed || 'Your name'}</p>
          <p className="stamp stamp--truncate">{email}</p>
        </div>
      </div>

      {/* İsim alanında Enter'a basmak kurulumu tamamlıyor — bkz. SignInCard */}
      <form
        className="form-stack"
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

        <div className="choice-field">
          <span className="field-head">
            <Label>profile photo</Label>
            <span className="stamp">
              {current?.name} · {avatar}
            </span>
          </span>

          <div className="swatch-grid">
            {AVATAR_COLOURS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setAvatar(c.hex)}
                aria-label={c.name}
                aria-pressed={c.hex === avatar}
                data-selected={c.hex === avatar}
                className="ring-choice avatar-choice"
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
