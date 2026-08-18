'use client';

import { useState } from 'react';
import { Butterfly } from '@/components/Butterfly';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Label } from '@/components/ui/Field';
import { ArrowLeft } from '@/components/ui/Icons';
import { AVATAR_COLOURS, NAME_MAX, type Profile } from '@/lib/types';

/*
 * Ekran 10 — ayarlar.
 *
 * Hesap silme bilinçli olarak ayrı duruyor: üstünde ince bir çizgi, kendi
 * uyarısı ve kırmızı konturlu bir buton. Handoff onay adımı istiyor ve
 * haklı — işlem geri alınamıyor ve kullanıcının bütün kelebeklerini anında
 * çayırdan kaldırıyor.
 *
 * Onay, hesap ismini yazdırarak alınıyor. Bir "emin misiniz" penceresi
 * refleksle geçiliyor; isim yazmak geçilemeyen tek eşik.
 */
export function SettingsCard({
  profile,
  onBack,
  onSaveName,
  onSaveAvatar,
  onDelete,
}: {
  profile: Profile;
  onBack: () => void;
  onSaveName: (name: string) => void;
  onSaveAvatar: (hex: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

  const current = AVATAR_COLOURS.find((c) => c.hex === profile.avatarHex);
  const nameChanged = name.trim() !== profile.name && name.trim().length > 0;

  function cancelDelete() {
    setConfirming(false);
    setTyped('');
  }

  return (
    <Card width={500}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[26px] leading-tight text-ink lg:text-[30px]">
          Settings
        </h2>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 font-mono text-[12px] tracking-[0.14em] text-accent transition-opacity hover:opacity-70"
        >
          <ArrowLeft />
          my account
        </button>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Field
            label="name"
            display
            maxLength={NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint={name.length + '/' + NAME_MAX}
          />
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-12 px-[22px]"
          disabled={!nameChanged}
          onClick={() => onSaveName(name.trim())}
        >
          Save
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <span className="flex items-baseline justify-between gap-3">
          <Label>profile photo</Label>
          <span className="font-mono text-[11px] tracking-[0.14em] text-faint">
            {current?.name} · {profile.avatarHex}
          </span>
        </span>

        <div className="flex flex-wrap gap-3 rounded-[14px] bg-panel p-4">
          {AVATAR_COLOURS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => onSaveAvatar(c.hex)}
              aria-label={c.name}
              aria-pressed={c.hex === profile.avatarHex}
              data-selected={c.hex === profile.avatarHex}
              className="ring-choice flex h-10 w-10 items-center justify-center rounded-full bg-card"
            >
              <Butterfly fore={c.hex} width={24} height={19} simple />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-[rgba(44,34,32,0.1)] pt-5">
        {!confirming ? (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink">
                Delete account
              </p>
              <p className="mt-1 max-w-[34ch] font-mono text-[11px] leading-[1.6] tracking-[0.14em] text-faint">
                your butterflies leave the meadow at once, and cannot be
                brought back
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="h-11 shrink-0 rounded-full border border-[rgba(168,54,43,0.4)] px-5 text-[14px] font-medium text-danger transition-colors hover:border-[rgba(168,54,43,0.7)] hover:bg-[rgba(168,54,43,0.08)]"
            >
              Delete
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[15px] font-semibold text-ink">
              Type {profile.name} to confirm
            </p>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Field
                  label="account name"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={profile.name}
                />
              </div>
              <button
                type="button"
                disabled={typed !== profile.name}
                onClick={onDelete}
                className="h-12 shrink-0 rounded-full border border-[rgba(168,54,43,0.4)] px-5 text-[14px] font-medium text-danger transition-colors hover:border-[rgba(168,54,43,0.7)] hover:bg-[rgba(168,54,43,0.08)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete for good
              </button>
            </div>
            <button
              type="button"
              onClick={cancelDelete}
              className="self-start font-mono text-[11px] tracking-[0.14em] text-muted hover:text-ink"
            >
              cancel
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
