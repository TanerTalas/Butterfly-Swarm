'use client';

import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Eye } from '@/components/ui/Icons';

/*
 * Form alanları.
 *
 * Tasarımda her alan aynı: monospace küçük etiket, 46–48px kutu, 12px köşe,
 * çok açık krem dolgu. İsim alanlarında değer Newsreader 20px ile yazılıyor
 * (kelebek ismi editöryel bir şey, form verisi gibi görünmemeli) ve sağ üstte
 * `n/18` sayacı duruyor.
 */

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[12px] tracking-[0.14em] text-label uppercase">
      {children}
    </span>
  );
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
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-3">
        <Label>{label}</Label>
        {hint ? (
          <span className="font-mono text-[11px] tracking-[0.14em] text-faint">
            {hint}
          </span>
        ) : null}
      </span>

      <input
        className={`h-12 w-full rounded-[12px] border border-[rgba(44,34,32,0.16)] bg-input px-4 text-ink outline-none transition-colors placeholder:text-[#A99B95] focus:border-[rgba(44,34,32,0.34)] ${
          display ? 'font-display text-[20px]' : 'text-[15px]'
        } ${className}`}
        {...rest}
      />

      {note ? (
        <span className="font-mono text-[11px] tracking-[0.14em] text-faint">
          {note}
        </span>
      ) : null}
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
    <div
      role="tablist"
      className="flex h-[46px] gap-1 rounded-full bg-track p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            /*
             * `type="button"` ŞART. Sekmeler artık bir <form> içinde
             * duruyor ve tipi verilmemiş bir <button> formda varsayılan
             * olarak SUBMIT oluyor — "Sign up" sekmesine tıklamak formu
             * gönderirdi.
             */
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-full text-[14px] font-medium transition-all duration-200 ${
              active
                ? 'bg-card text-ink shadow-[0_2px_6px_rgba(74,59,56,0.12)]'
                : 'text-muted hover:text-body'
            }`}
          >
            {o.label}
          </button>
        );
      })}
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
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-3">
        <Label>{label}</Label>
        {hint ? (
          <span className="font-mono text-[11px] tracking-[0.14em] text-faint">
            {hint}
          </span>
        ) : null}
      </span>

      <span className="relative block">
        <input
          type={visible ? 'text' : 'password'}
          className={`h-12 w-full rounded-[12px] border border-[rgba(44,34,32,0.16)] bg-input pl-4 pr-12 text-[15px] text-ink outline-none transition-colors placeholder:text-[#A99B95] focus:border-[rgba(44,34,32,0.34)] ${className}`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'hide password' : 'show password'}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-panel hover:text-ink"
        >
          <Eye off={visible} />
        </button>
      </span>

      {note ? (
        <span className="font-mono text-[11px] tracking-[0.14em] text-faint">
          {note}
        </span>
      ) : null}
    </label>
  );
}
