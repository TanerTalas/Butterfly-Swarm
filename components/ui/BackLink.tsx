'use client';

import { ArrowLeft } from '@/components/ui/Icons';

/*
 * Geri dönüş.
 *
 * Tasarımda yalnızca ayarlar ekranında çizilmişti ("my account" + sol ok) ama
 * her kartta gerekiyor: kanat seçimine giren kullanıcı çıkamıyordu, yani
 * sistem onu kelebek yaratmaya zorluyordu. Bir akışa girmenin geri dönüşü
 * olmalı.
 *
 * Ayarlar ekranındaki dil aynen kullanılıyor — 16px çizgi ok, monospace
 * etiket, vurgu rengi. Yeni bir görsel dil uydurmaya gerek yok.
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
