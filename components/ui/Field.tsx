'use client';

import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { Eye } from '@/components/ui/Icons';

/*
 * Form alanları.
 *
 * Tasarımda her alan aynı: monospace küçük etiket, 48px kutu, 12px köşe,
 * çok açık krem dolgu. Görünüm `app/styles/forms.css`'te.
 */

export function Label({ children }: { children: ReactNode }) {
  return <span className="field-label">{children}</span>;
}

export type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  /** Sağ üstte gösterilen ek bilgi — genelde `4/18` sayacı. */
  hint?: ReactNode;
  /** Etiket altındaki açıklama. */
  note?: ReactNode;
  /** Kelebek/profil ismi gibi editöryel değerler için. */
  display?: boolean;
  /**
   * Hatalı alan: uyarı çerçevesi ve `aria-invalid`.
   *
   * Renk TEK BAŞINA bir işaret değil — hangi alanın neden hatalı olduğunu
   * söyleyen metin her zaman ayrıca yazılıyor (bkz. `SignInCard`), çünkü
   * renk körü bir kullanıcı için kırmızı çerçevenin hiçbir anlamı yok.
   */
  invalid?: boolean;
  /** Alt notu uyarı rengine çevirir — kural ihlal edilmişken. */
  noteDanger?: boolean;
};

export function Field({
  label,
  hint,
  note,
  display,
  invalid,
  noteDanger,
  className = '',
  ...rest
}: FieldProps) {
  return (
    <label className="field">
      <span className="field-head">
        <Label>{label}</Label>
        {hint ? <span className="stamp">{hint}</span> : null}
      </span>

      <input
        className={inputClass(display, invalid, className)}
        aria-invalid={invalid || undefined}
        {...rest}
      />

      {note ? (
        <span className={`stamp ${noteDanger ? 'stamp--danger' : ''}`.trim()}>
          {note}
        </span>
      ) : null}
    </label>
  );
}

function inputClass(display?: boolean, invalid?: boolean, extra = '') {
  return [
    'field-input',
    display ? 'field-input--display' : '',
    invalid ? 'field-input--invalid' : '',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Bölümlü denetim — giriş / kayıt sekmeleri.
 * Etkin sekme krem bir kart gibi yükseliyor, diğeri pistin üstünde düz.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="tablist" className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          /*
           * `type="button"` ŞART. Sekmeler bir <form> içinde duruyor ve
           * tipi verilmemiş bir <button> formda varsayılan olarak SUBMIT
           * oluyor — "Sign up" sekmesine tıklamak formu gönderirdi.
           */
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className="segmented-option"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/*
 * Şifre alanı — içinde gösterme düğmesiyle.
 *
 * Düğme kutunun İÇİNDE sağda duruyor, dışında değil: alanın genişliği
 * değişmiyor ve etiket/sayaç hizası bozulmuyor.
 *
 * Erişilebilirlik ayrıntıları, çünkü bu düğme kolayca yanlış yapılıyor:
 *   - `type="button"`, yoksa formu gönderiyor
 *   - `aria-label` duruma göre değişiyor ("show"/"hide")
 *   - `tabIndex={-1}` YOK: klavyeyle ulaşılabilmeli
 *   - ikon `aria-hidden`, etiketi düğme taşıyor
 */
export function PasswordField({
  label,
  hint,
  note,
  invalid,
  noteDanger,
  ref,
  className = '',
  ...rest
}: Omit<FieldProps, 'display' | 'type'> & {
  /**
   * Girişteki hata odağı bu alana taşıyor (bkz. `SignInCard`), o yüzden
   * dışarıdan tutulabilmesi gerekiyor. React 19'da `ref` sıradan bir prop;
   * `forwardRef` sarmalayıcısına gerek yok.
   */
  ref?: Ref<HTMLInputElement>;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="field">
      <span className="field-head">
        <Label>{label}</Label>
        {hint ? <span className="stamp">{hint}</span> : null}
      </span>

      <span className="password-wrap">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={inputClass(
            false,
            invalid,
            `field-input--password ${className}`.trim(),
          )}
          aria-invalid={invalid || undefined}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'hide password' : 'show password'}
          aria-pressed={visible}
          className="password-toggle"
        >
          <Eye off={visible} />
        </button>
      </span>

      {note ? (
        <span className={`stamp ${noteDanger ? 'stamp--danger' : ''}`.trim()}>
          {note}
        </span>
      ) : null}
    </label>
  );
}
