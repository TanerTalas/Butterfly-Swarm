'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Label } from '@/components/ui/Field';

/*
 * İletişim formu.
 *
 * ⚠ Henüz hiçbir yere göndermiyor. Sunucu tarafı Aşama C'de gelecek ve
 * handoff'un güvenlik notu üç şey istiyor: Turnstile, IP başına sınır ve
 * bir bal küpü alanı. Bal küpü şimdiden burada — botlar formu doldurur,
 * insanlar göremez — ama tek başına bir koruma değil.
 */
export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const canSend =
    name.trim().length > 0 && email.includes('@') && message.trim().length > 4;

  if (sent) {
    return (
      <div className="rounded-[14px] bg-panel p-6">
        <p className="text-[15px] leading-[1.65] text-body">
          Thank you. We will write back to {email}.
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4 border-t border-[rgba(44,34,32,0.1)] pt-8"
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
    >
      <Field
        label="name"
        value={name}
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

      <label className="flex flex-col gap-2">
        <Label>message</Label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="h-24 w-full resize-none rounded-[12px] border border-[rgba(44,34,32,0.16)] bg-input px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-[#A99B95] focus:border-[rgba(44,34,32,0.34)]"
        />
      </label>

      {/* Bal küpü — ekranda ve okuyucularda görünmüyor, botlar dolduruyor */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />

      <Button size="md" type="submit" disabled={!canSend} className="self-start">
        Send
      </Button>
    </form>
  );
}
