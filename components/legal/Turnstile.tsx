'use client';

import { useEffect, useRef } from 'react';

/*
 * Cloudflare Turnstile widget'ı.
 *
 * ⚠ SİTE ANAHTARI sunucudan PROP olarak geliyor, `NEXT_PUBLIC_` değişkenden
 * değil. Değerin kendisi açık olabilir (widget onu zaten tarayıcıda taşıyor)
 * ama proje kuralı `NEXT_PUBLIC_` bir değişken bulundurmamak (CLAUDE.md), ve
 * yasal sayfa zaten bir Server Component: anahtarı okuyup geçirebiliyor.
 * Gizli anahtar bambaşka bir değer ve yalnızca `lib/server/turnstile.ts`te.
 *
 * ⚠ Anahtar yoksa bu bileşen HİÇ ÇİZİLMİYOR (çağıran tarafta). Geliştirmede
 * Cloudflare hesabı olmadan da form uçtan uca denenebiliyor; sunucu tarafı da
 * aynı sebeple anahtarsızken geçiriyor.
 */

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback': () => void;
      'expired-callback': () => void;
      theme?: 'light' | 'dark' | 'auto';
    },
  ) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/*
 * Betik SAYFA BAŞINA bir kez iniyor ve söz paylaşılıyor. İki widget birden
 * çizilseydi (bugün çizilmiyor) ikinci bir <script> etiketi Turnstile'ın kendi
 * durumunu bozardı.
 */
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();

  loading ??= new Promise<void>((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = SRC;
    tag.async = true;
    tag.onload = () => resolve();
    tag.onerror = () => reject(new Error('turnstile yüklenemedi'));
    document.head.appendChild(tag);
  });

  return loading;
}

export function Turnstile({
  siteKey,
  onToken,
  resetKey = 0,
}: {
  siteKey: string;
  /** Token hazır olduğunda; süresi dolduğunda ya da hata olduğunda `null`. */
  onToken: (token: string | null) => void;
  /**
   * Değişince widget sıfırlanıyor.
   *
   * ⚠ Token TEK KULLANIMLIK. Reddedilen bir gönderimden sonra sıfırlanmazsa
   * kullanıcı aynı ölü token'la tekrar dener ve ikinci kez de reddedilir —
   * ekranda düzeltilemeyen bir hata gibi görünür.
   */
  resetKey?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  /*
   * Geri çağrı bir ref'te tutuluyor: prop her render'da yeni bir fonksiyon ve
   * bağımlılığa konsaydı widget her render'da sökülüp yeniden çizilirdi.
   */
  const notify = useRef(onToken);
  notify.current = onToken;

  useEffect(() => {
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !holder.current || !window.turnstile) return;

        widget.current = window.turnstile.render(holder.current, {
          sitekey: siteKey,
          callback: (token) => notify.current(token),
          /*
           * Hata ve süre dolması AYNI şeye düşüyor: elimizde token yok. Form
           * yine de gönderilebiliyor ve reddi sunucu veriyor — arıza yüzünden
           * kilitlenen bir buton, iletişim sayfasını kapatmak demek olurdu
           * (bkz. `turnstile.ts`).
           */
          'error-callback': () => notify.current(null),
          'expired-callback': () => notify.current(null),
          theme: 'light',
        });
      })
      .catch(() => {
        // Betik inmediyse yapılacak bir şey yok; token'sız gönderim serbest.
      });

    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) {
        window.turnstile.remove(widget.current);
        widget.current = null;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey === 0) return;
    if (widget.current && window.turnstile) {
      window.turnstile.reset(widget.current);
      notify.current(null);
    }
  }, [resetKey]);

  return <div ref={holder} className="contact-check" />;
}
