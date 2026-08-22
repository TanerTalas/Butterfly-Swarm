'use client';

import { useState } from 'react';
import { Turnstile } from '@/components/legal/Turnstile';
import { Button } from '@/components/ui/Button';
import { Field, Label } from '@/components/ui/Field';
import { sendContactMessage } from '@/app/actions/contact';
import {
  CONTACT_BODY_MAX,
  CONTACT_NAME_MAX,
  type ContactFailure,
} from '@/lib/types';

/*
 * İletişim formu.
 *
 * Sitedeki İKİNCİ kimliksiz yazma noktası (ilki misafir salma) ve bir farkı
 * var: yazılan şey serbest metin, yani kendiliğinden duran bir sınırı yok.
 * Üç koruma birden: bal küpü (aşağıda), bot kontrolü (Turnstile) ve IP başına
 * saatlik kısıt (`lib/server/contact.ts`).
 *
 * ⚠ Buton TOKEN'A BAKMIYOR. Bot kontrolü inmediyse ya da süresi dolduysa
 * gönderim yine de yapılabiliyor ve reddi sunucu veriyor. Sebebi
 * `lib/server/turnstile.ts`teki kararla aynı: gizlilik metni bu sayfadan
 * yazılabileceğine söz veriyor, o yüzden kapının kapanması arızaya
 * bırakılamaz.
 */
export function ContactForm({ siteKey }: { siteKey?: string | null }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ContactFailure | null>(null);
  const [sent, setSent] = useState(false);

  /*
   * Turnstile token'ı TEK KULLANIMLIK: reddedilen her denemeden sonra widget
   * sıfırlanmalı, yoksa ikinci deneme ölü token'la gider ve kullanıcı
   * düzeltilemeyen bir hataya bakar.
   */
  const [checkRound, setCheckRound] = useState(0);

  const canSend =
    name.trim().length > 0 && email.includes('@') && message.trim().length > 4;

  /*
   * KURAL İHLALİ kilitler, ARIZA kilitlemez — salmadaki kuralın aynısı
   * (`ReleaseNotice`). Saatlik kısıt beklemekten başka bir şeyle geçilmiyor,
   * o yüzden butonu kapatıyor; ağ hatası ve geçilemeyen kontrol kapatmıyor.
   */
  const blocked = failure?.kind === 'rate-limit';

  if (sent) {
    return (
      <div className="contact-sent">
        <p className="legal-section-body">
          Thank you. We will write back to {email}.
        </p>
      </div>
    );
  }

  async function submit() {
    setFailure(null);
    setPending(true);
    const result = await sendContactMessage({
      name,
      email,
      body: message,
      honeypot,
      token,
    });
    setPending(false);

    if (!result.ok) {
      setFailure(result.error);
      setCheckRound((n) => n + 1);
      return;
    }

    setSent(true);
  }

  return (
    <form
      className="contact-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSend || pending || blocked) return;
        void submit();
      }}
    >
      <Field
        label="name"
        value={name}
        maxLength={CONTACT_NAME_MAX}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
      />
      <Field
        label="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />

      <label className="field">
        <Label>message</Label>
        <textarea
          value={message}
          maxLength={CONTACT_BODY_MAX}
          onChange={(e) => setMessage(e.target.value)}
          className="field-textarea"
        />
      </label>

      {/* Bal küpü — ekranda ve okuyucularda görünmüyor, botlar dolduruyor */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="honeypot"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
      />

      {/*
       * Widget yalnızca anahtar VARSA çiziliyor. Anahtarsız geliştirmede
       * sayfada hiç yer kaplamıyor ve form uçtan uca denenebiliyor.
       */}
      {siteKey ? (
        <Turnstile
          siteKey={siteKey}
          onToken={setToken}
          resetKey={checkRound}
        />
      ) : null}

      <Button
        size="md"
        type="submit"
        disabled={!canSend || pending || blocked}
        className="button--start"
      >
        {pending ? 'Sending…' : 'Send'}
      </Button>

      {/*
       * Red kullanıcının BASMASIYLA geliyor: beklenen bir an ve kesintiye
       * değer, o yüzden `role="alert"` (salmadaki `ReleaseNotice` ile aynı
       * karar). Dil de aynı: küçük harf, nokta yok, suçlayıcı değil.
       */}
      {failure && (
        <p className="note note--danger" role="alert">
          {COPY[failure.kind]}
        </p>
      )}
    </form>
  );
}

const COPY: Record<ContactFailure['kind'], string> = {
  /*
   * "bot" kelimesi geçmiyor: kontrolü geçemeyen çoğu zaman bir insan ve
   * sebebi bir eklenti ya da kesinti oluyor. Yapılacak şey söyleniyor.
   */
  check: 'the check did not pass · reload the page and try again',
  'rate-limit': 'a few messages already came from here · try again in an hour',
  network: 'that did not reach us · nothing was sent',
};
