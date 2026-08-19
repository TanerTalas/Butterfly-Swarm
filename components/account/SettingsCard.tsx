'use client';

import { useState } from 'react';
import { Butterfly } from '@/components/Butterfly';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Label } from '@/components/ui/Field';
import { AVATAR_COLOURS, NAME_MAX, type Profile } from '@/lib/types';

/*
 * Ayarlar.
 *
 * Yeni tasarımda isim ve profil rengi TEK "Save" ile kaydediliyor. Önceden
 * ismin yanında ayrı bir kaydet düğmesi vardı ve renk anında uygulanıyordu;
 * artık ikisi bir arada, çünkü ikisi birlikte 1 günlük kilide giriyor.
 *
 * Kilit notu ("once saved, name and colour cannot be changed again for 1 day")
 * boş bir uyarı değil — kaydetmeyi geri alınamaz bir adım yapıyor. Bu yüzden
 * kaydedilmemiş değişiklik varken buton etkin, yokken devre dışı: kullanıcı
 * ne zaman gerçekten bir şey harcadığını görüyor.
 *
 * ⚠ Kilidi SUNUCU uygulamalı (Aşama C). Buradaki durum yalnızca arayüz;
 * istemcide tutulan bir tarih tarayıcı yenilenince sıfırlanır.
 */
export function SettingsCard({
  profile,
  onBack,
  onSave,
  onDelete,
  lockedUntil,
}: {
  profile: Profile;
  onBack: () => void;
  onSave: (name: string, avatarHex: string) => void;
  onDelete: () => void;
  /** Doluysa değişiklik kilitli — sunucudan gelecek. */
  lockedUntil?: Date | null;
}) {
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatarHex);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

  const current = AVATAR_COLOURS.find((c) => c.hex === avatar);
  const locked = Boolean(lockedUntil && lockedUntil > new Date());
  const changed =
    (name.trim() !== profile.name || avatar !== profile.avatarHex) &&
    name.trim().length > 0;

  function cancelDelete() {
    setConfirming(false);
    setTyped('');
  }

  return (
    <Card width={500}>
      <BackLink label="my account" onClick={onBack} />

      <h2 className="font-display text-[26px] leading-none text-ink lg:text-[30px]">
        Settings
      </h2>

      <Field
        label="name"
        display
        maxLength={NAME_MAX}
        value={name}
        disabled={locked}
        onChange={(e) => setName(e.target.value)}
        hint={name.length + '/' + NAME_MAX}
      />

      <div className="flex flex-col gap-2.5">
        <span className="flex items-baseline justify-between gap-3">
          <Label>profile photo</Label>
          <span className="font-mono text-[11px] tracking-[0.14em] text-muted">
            {current?.name} · {avatar}
          </span>
        </span>

        <div className="flex flex-wrap gap-2.5 rounded-[14px] bg-panel px-5 py-[18px]">
          {AVATAR_COLOURS.map((c) => (
            <button
              key={c.hex}
              type="button"
              disabled={locked}
              onClick={() => setAvatar(c.hex)}
              aria-label={c.name}
              aria-pressed={c.hex === avatar}
              data-selected={c.hex === avatar}
              className="ring-choice flex h-10 w-10 items-center justify-center rounded-full bg-card disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Butterfly fore={c.hex} width={24} height={19} simple />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          size="md"
          fullWidth
          disabled={locked || !changed}
          onClick={() => onSave(name.trim(), avatar)}
        >
          Save
        </Button>
        <p className="text-center font-mono text-[11px] leading-[1.6] tracking-[0.14em] text-faint">
          {locked
            ? 'name and colour are locked for now, try again tomorrow'
            : 'once saved, name and colour cannot be changed again for 1 day'}
        </p>
      </div>

      {/* Tehlikeli bölge */}
      <div className="flex flex-col gap-3 border-t border-[rgba(44,34,32,0.1)] pt-5">
        {!confirming ? (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink">
                Delete account
              </p>
              <p className="mt-1.5 max-w-[34ch] font-mono text-[11px] leading-[1.6] tracking-[0.14em] text-faint">
                your butterflies leave the meadow at once, and cannot be
                brought back
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="h-11 shrink-0 rounded-full border border-[rgba(168,54,43,0.4)] px-[22px] text-[14px] whitespace-nowrap text-danger transition-colors hover:border-[rgba(168,54,43,0.7)] hover:bg-[rgba(168,54,43,0.08)]"
            >
              Delete
            </button>
          </div>
        ) : (
          /*
           * Onay adımı: hesap ismini yazdırıyor. Bir "emin misiniz" penceresi
           * refleksle geçiliyor; isim yazmak geçilemeyen tek eşik.
           */
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
                className="h-12 shrink-0 rounded-full border border-[rgba(168,54,43,0.4)] px-5 text-[14px] whitespace-nowrap text-danger transition-colors hover:border-[rgba(168,54,43,0.7)] hover:bg-[rgba(168,54,43,0.08)] disabled:cursor-not-allowed disabled:opacity-40"
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
