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
 * ⚠ Kilidi SUNUCU uyguluyor (`app/actions/account.ts`) ve bitiş anı hesap
 * satırında duruyor. Buradaki `lockedUntil` yalnızca onun görünen yüzü:
 * istemcide tutulan bir tarih tarayıcı yenilenince sıfırlanırdı ve not
 * tutulmayan bir söz olurdu.
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
  /** Doluysa değişiklik kilitli — sunucudan geliyor (`readAccountFacts`). */
  lockedUntil?: Date | null;
}) {
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatarHex);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

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

      <h2 className="card-title">Settings</h2>

      {/*
       * Form yalnızca İSİM + RENK + Save'i sarıyor.
       *
       * Aşağıdaki silme onayı bilerek DIŞARIDA: aynı formun içinde olsaydı
       * hesap adını yazarken Enter'a basmak formu gönderirdi ve orada
       * hangi düğmenin varsayılan sayılacağı ince bir ayrıntıya kalırdı.
       * Hesap silmenin klavyeyle kazara tetiklenebilmesi kabul edilebilir
       * bir risk değil; o adım tıklamayla kalıyor.
       */}
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (locked || !changed) return;
          onSave(name.trim(), avatar);
        }}
      >
        <Field
          label="name"
          display
          maxLength={NAME_MAX}
          value={name}
          disabled={locked}
          onChange={(e) => setName(e.target.value)}
          hint={name.length + '/' + NAME_MAX}
        />

        <div className="choice-field choice-field--tight">
          <Label>profile photo</Label>

          <div className="avatar-picker">
            {AVATAR_COLOURS.map((c) => (
              <button
                key={c.hex}
                type="button"
                disabled={locked}
                onClick={() => setAvatar(c.hex)}
                aria-label={c.name}
                aria-pressed={c.hex === avatar}
                data-selected={c.hex === avatar}
                className="ring-choice avatar-choice avatar-choice--sm"
              >
                <Butterfly fore={c.hex} width={24} height={19} simple />
              </button>
            ))}
          </div>
        </div>

        <div className="action-stack">
          <Button
            size="md"
            type="submit"
            fullWidth
            disabled={locked || !changed}
          >
            Save
          </Button>

          <p className="note note--center">
            {locked
              ? 'name and colour are locked for now, try again tomorrow'
              : 'once saved, name and colour cannot be changed again for 1 day'}
          </p>
        </div>
      </form>

      {/* Tehlikeli bölge */}
      <div className="card-danger-zone">
        {!confirming ? (
          <div className="danger-row">
            <div className="danger-copy">
              <p className="danger-title">Delete account</p>
              <p className="danger-note">
                your butterflies leave the meadow at once, and cannot be
                brought back
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="button--danger button--danger-sm"
            >
              Delete
            </button>
          </div>
        ) : (
          /*
           * Onay adımı: hesap ismini yazdırıyor. Bir "emin misiniz" penceresi
           * refleksle geçiliyor; isim yazmak geçilemeyen tek eşik.
           */
          <div className="confirm-stack">
            <p className="danger-title">Type {profile.name} to confirm</p>
            <div className="confirm-row">
              <div className="confirm-field">
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
                className="button--danger button--danger-lg"
              >
                Delete for good
              </button>
            </div>
            <button type="button" onClick={cancelDelete} className="link-cancel">
              cancel
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
