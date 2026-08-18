'use client';

import { useState } from 'react';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Segmented } from '@/components/ui/Field';

/*
 * Ekran 04 — giriş / kayıt.
 *
 * Tek kart, iki sekme. Google butonu resmi dört renkli işareti SOLDA
 * taşıyor (handoff bunu açıkça yazıyor); marka işaretleri yeniden
 * renklendirilmiyor.
 *
 * ⚠ Hata metinleri kullanıcı sayımına izin vermemeli: "email or password is
 * wrong" — hangi alanın yanlış olduğu söylenmez (handoff güvenlik notu).
 * Doğrulama sunucuya bağlanınca buraya gelecek.
 */
export function SignInCard({
  onDone,
  onNeedsSetup,
  onBack,
}: {
  onDone: (email: string) => void;
  onNeedsSetup: (email: string) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = email.includes('@') && password.length >= 10;

  return (
    <Card width={440}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[28px] leading-tight text-ink lg:text-[32px]">
          Enter the meadow
        </h2>
        <BackLink label="back" onClick={onBack} />
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'in', label: 'Sign in' },
          { value: 'up', label: 'Create account' },
        ]}
      />

      <div className="flex flex-col gap-4">
        <Field
          label="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="password"
          type="password"
          autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
          placeholder="at least 10 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          note={tab === 'up' ? 'at least 10 characters' : undefined}
        />
      </div>

      <Button
        size="md"
        fullWidth
        disabled={!canSubmit}
        onClick={() => (tab === 'in' ? onDone(email) : onNeedsSetup(email))}
      >
        {tab === 'in' ? 'Sign in' : 'Create account'}
      </Button>

      <button
        type="button"
        onClick={() => onNeedsSetup('you@example.com')}
        className="flex h-[50px] items-center justify-center gap-2.5 rounded-full border border-[rgba(44,34,32,0.18)] bg-input text-[15px] font-medium text-ink transition-colors hover:border-[rgba(44,34,32,0.34)]"
      >
        <GoogleMark />
        Continue with Google
      </button>

      <p className="font-mono text-[11px] leading-[1.6] tracking-[0.14em] text-faint">
        by continuing you agree to the{' '}
        <a href="/legal/terms" className="text-accent hover:underline">
          terms
        </a>
      </p>
    </Card>
  );
}

/** Google'ın resmi dört renkli işareti — yeniden renklendirilmiyor. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
