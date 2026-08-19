'use client';

import { ArrowLeft } from '@/components/ui/Icons';

/*
 * Geri dönüş.
 *
 * Yeni tasarımda her kartın EN ÜSTÜNDE, kendi satırında duruyor — başlıkla
 * aynı hizada değil, onun üzerinde. Etiket çoğu yerde "back to the meadow";
 * ayarlarda "my account", geçmişte "my butterflies", kayıt adımında "back".
 * Yani etiket nereye döneceğini söylüyor, sadece "geri" demiyor.
 */
export function BackLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 font-mono text-[12px] tracking-[0.14em] text-accent transition-opacity hover:opacity-70"
    >
      <ArrowLeft />
      {label}
    </button>
  );
}
