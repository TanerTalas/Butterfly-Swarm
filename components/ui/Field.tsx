'use client';

import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
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
};

export function Field({
  label,
  hint,
  note,
  display,
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
        className={`field-input ${display ? 'field-input--display' : ''} ${className}`.trim()}
        {...rest}
      />

      {note ? <span className="stamp">{note}</span> : null}
    </label>
  );
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
  className = '',
  ...rest
}: Omit<FieldProps, 'display' | 'type'>) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="field">
      <span className="field-head">
        <Label>{label}</Label>
        {hint ? <span className="stamp">{hint}</span> : null}
      </span>

      <span className="password-wrap">
        <input
          type={visible ? 'text' : 'password'}
          className={`field-input field-input--password ${className}`.trim()}
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

      {note ? <span className="stamp">{note}</span> : null}
    </label>
  );
}
