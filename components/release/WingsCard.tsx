'use client';

import { useEffect, useState } from 'react';
import { Butterfly } from '@/components/Butterfly';
import { ButterflyPreview3D } from '@/components/release/ButterflyPreview3D';
import { ColourPicker } from '@/components/release/ColourPicker';
import {
  ReleaseNotice,
  releaseLock,
} from '@/components/release/ReleaseNotice';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Label } from '@/components/ui/Field';
import { ColourSwatch, ColourWheelButton } from '@/components/ui/Swatch';
import { readDraft, writeDraft } from '@/lib/draft';
import {
  NAME_MAX,
  SLOT_LIMIT,
  WING_COLOURS,
  type ReleaseFailure,
} from '@/lib/types';

/*
 * Ekran 07 — kanat seçimi (yalnızca üyeler).
 *
 * Karttaki küçük önizleme SVG kalıyor: her renk tıklamasında yeniden
 * çizilmesi bedava ve kartın içinde 124x100 alanda 3B'ye gerek yok.
 * "Preview" ise GERÇEK kelebeği açıyor — sürünün geometrisi, deseni ve
 * çırpma shader'ıyla (bkz. ButterflyPreview3D).
 */
export function WingsCard({
  slotsUsed,
  onRelease,
  onBack,
  onGoToList,
  pending,
  failure,
}: {
  slotsUsed: number;
  onRelease: (name: string, fore: string, hind: string) => void;
  onBack: () => void;
  /** Yuvalar dolduğunda kullanıcıyı listeye götüren çıkış (D4). */
  onGoToList?: () => void;
  pending?: boolean;
  /** Basıldıktan SONRA reddedildi (D4 / D5). */
  failure?: ReleaseFailure | null;
}) {
  const [fore, setFore] = useState<string>(WING_COLOURS[0].hex);
  const [hind, setHind] = useState<string>(WING_COLOURS[1].hex);
  const [name, setName] = useState('');
  const [picker, setPicker] = useState<null | 'fore' | 'hind'>(null);
  const [preview, setPreview] = useState(false);

  useDraft({ name, fore, hind, setName, setFore, setHind });

  const trimmed = name.trim();

  /*
   * Damga REDDİ de sayıyor.
   *
   * Sunucu "yuvalar dolu" dediyse ekrandaki sayının hâlâ 3/5 demesi
   * kullanıcıya yalan söylemek olur — hele ki hemen altında dolduğunu yazan
   * bir not varken. `slotsUsed` prop'u bir sonraki listede zaten güncellenmiş
   * gelecek; buradaki yalnızca o gelene kadarki tek kareyi doğru tutuyor.
   *
   * Bu bir TAHMİN değil: `slots-full` cevabının anlamı tam olarak sayının
   * tavanda olması.
   */
  const full = slotsUsed >= SLOT_LIMIT || failure?.kind === 'slots-full';
  const shown = full ? SLOT_LIMIT : slotsUsed;

  /*
   * Kural ihlali butonu kilitliyor, arıza kilitlemiyor — ağ hatasında
   * yeniden basılabilmeli (bkz. `releaseLock`).
   */
  const lock = releaseLock(failure);

  return (
    <>
      <Card width={520}>
        <BackLink label="back to the meadow" onClick={onBack} />

        <div className="card-head">
          <h2 className="card-title card-title--lead">Choose its wings</h2>
          {/*
           * Sayaç CANLI. Yuvalar kart açıkken dolabiliyor (başka sekme) ve
           * o an ekrandaki tek doğru yer burası — red notu neden olduğunu
           * söylüyor, damga kaç olduğunu.
           */}
          <span className={`stamp ${full ? 'stamp--full' : ''}`.trim()}>
            {shown}/{SLOT_LIMIT}
          </span>
        </div>

        <div className="wings-layout">
          <div className="wings-preview">
            <Butterfly fore={fore} hind={hind} width={124} height={100} />
          </div>

          <div className="wings-controls">
            <WingRow
              label="forewing"
              value={fore}
              onSelect={setFore}
              pickerOpen={picker === 'fore'}
              onTogglePicker={() =>
                setPicker(picker === 'fore' ? null : 'fore')
              }
              onClosePicker={() => setPicker(null)}
            />
            <WingRow
              label="hindwing"
              value={hind}
              onSelect={setHind}
              pickerOpen={picker === 'hind'}
              onTogglePicker={() =>
                setPicker(picker === 'hind' ? null : 'hind')
              }
              onClosePicker={() => setPicker(null)}
            />
          </div>
        </div>

        {/*
         * İsim alanında Enter salıveriyor — formun varsayılan düğmesi
         * "Let it go". İsim yazıp Enter'a basmak bu ekranın doğal bitişi.
         *
         * ⚠ "Preview" AYNI form içinde ve `type="button"` olmak zorunda:
         * tipi verilmemiş bir <button> formda submit sayılıyor, yani
         * önizleme açmak isteyen kullanıcı kelebeği salıvermiş olurdu.
         */}
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (pending || trimmed.length === 0 || lock !== null) return;
            onRelease(trimmed, fore, hind);
          }}
        >
          <Field
            label="name"
            display
            maxLength={NAME_MAX}
            placeholder="Mint"
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint={name.length + '/' + NAME_MAX}
          />

          <div className="action-row">
            <Button
              className="button--grow"
              type="submit"
              disabled={pending || trimmed.length === 0 || lock !== null}
            >
              {lock
                ? lock.label
                : pending
                  ? 'Letting it go…'
                  : 'Let it go'}
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setPreview(true)}
            >
              Preview
            </Button>
          </div>

          {failure && (
            <ReleaseNotice failure={failure} onGoToList={onGoToList} />
          )}
        </form>
      </Card>

      {preview && (
        <PreviewOverlay
          fore={fore}
          hind={hind}
          name={trimmed}
          onClose={() => setPreview(false)}
        />
      )}
    </>
  );
}

/*
 * Yarım kalmış kelebeği sekme ömrü boyunca saklar (§6.4).
 *
 * ⚠ İLK RENDER'DA OKUNMUYOR. `useState` başlangıç değeri olarak
 * `sessionStorage` okumak hidrasyon uyuşmazlığı demek: sunucu boş bir kart
 * çiziyor, istemcinin ilk render'ı dolu bir kart çizerse React ikisini
 * eşleştiremiyor. Bu yüzden okuma MONTAJDAN SONRA, bir effect içinde.
 *
 * ⚠ Kaydetme, geri yükleme BİTENE kadar beklemek zorunda — ve bayrak bir
 * `ref` OLAMAZ. İki effect de aynı geçişte, sırayla çalışıyor: geri yükleyen
 * durumu güncelliyor ama o güncelleme bir sonraki render'da görünüyor,
 * dolayısıyla kaydeden hâlâ BOŞ başlangıç değerlerini görüyor. Bayrak ref
 * olsaydı o anda çoktan `true` olur ve kaydeden, taslağın üstüne boş bir
 * taslak yazardı — yani taslak tam okunduğu anda silinirdi.
 *
 * Durum olarak tutulunca kaydeden ilk geçişte bayrağı `false` görüp
 * atlıyor; bayrağın `true` olması yeni bir render tetikliyor ve o render'da
 * değerler artık geri yüklenmiş oluyor.
 *
 * Taslak salma BAŞARILI olunca siliniyor ve silme burada değil `Garden`da:
 * salmanın gerçekten olduğunu bilen tek yer orası (bkz. `clearDraft`).
 */
function useDraft({
  name,
  fore,
  hind,
  setName,
  setFore,
  setHind,
}: {
  name: string;
  fore: string;
  hind: string;
  setName: (v: string) => void;
  setFore: (v: string) => void;
  setHind: (v: string) => void;
}) {
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      setName(draft.name);
      setFore(draft.fore);
      setHind(draft.hind);
    }
    setRestored(true);
    // Yalnızca montajda: sonraki değişiklikler kullanıcının kendi işi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restored) return;
    writeDraft({ name, fore, hind });
  }, [restored, name, fore, hind]);
}

/** Tek kanat çifti için etiket, değer, örnekler ve çark. */
function WingRow({
  label,
  value,
  onSelect,
  pickerOpen,
  onTogglePicker,
  onClosePicker,
}: {
  label: string;
  value: string;
  onSelect: (hex: string) => void;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onClosePicker: () => void;
}) {
  const named = WING_COLOURS.find(
    (c) => c.hex.toUpperCase() === value.toUpperCase(),
  );

  return (
    <div className="wing-row">
      <span className="field-head">
        <Label>{label}</Label>
        <span className="stamp">
          {named ? named.name + ' · ' : 'custom · '}
          {value.toUpperCase()}
        </span>
      </span>

      <div className="swatch-row">
        {WING_COLOURS.map((c) => (
          <ColourSwatch
            key={c.hex}
            hex={c.hex}
            label={c.name}
            selected={c.hex.toUpperCase() === value.toUpperCase()}
            onSelect={() => onSelect(c.hex)}
          />
        ))}
        <ColourWheelButton active={pickerOpen} onClick={onTogglePicker} />
      </div>

      {pickerOpen && (
        <ColourPicker
          selected={value}
          onSelect={onSelect}
          onClose={onClosePicker}
        />
      )}
    </div>
  );
}

/*
 * Önizleme katmanı — gerçek kelebek, salınmadan önceki hâli.
 * Çayır arkada duruyor ama krem bir perdeyle örtülüyor; salmadan
 * kapatılabilir.
 */
function PreviewOverlay({
  fore,
  hind,
  name,
  onClose,
}: {
  fore: string;
  hind: string;
  name: string;
  onClose: () => void;
}) {
  return (
    <div className="preview-overlay" role="dialog" aria-label="butterfly preview">
      <p className="eyebrow">before it goes</p>

      <ButterflyPreview3D fore={fore} hind={hind} />

      <div className="preview-caption">
        <p className="preview-name">{name || 'Your butterfly'}</p>
        <p className="stamp">
          {fore.toUpperCase()} · {hind.toUpperCase()}
        </p>
      </div>

      <Button variant="secondary" onClick={onClose}>
        Back to the colours
      </Button>
    </div>
  );
}
