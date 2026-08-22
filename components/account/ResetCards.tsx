'use client';

import { useState } from 'react';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, PasswordField } from '@/components/ui/Field';
import { PASSWORD_MIN } from '@/lib/types';

/*
 * Şifre sıfırlamanın iki ekranı.
 *
 * ⚠ Biçim `VerifyCard`tan alınıyor (Card 440, geri bağlantısı, `card-intro`,
 * alt `note`), yeni bir görsel kalıp icat edilmiyor. İkisi de zaten var olan
 * bir şeyin ikinci hâli: biri "postana baktık" diyor, diğeri bir şifre alanı
 * gösteriyor.
 */

/**
 * "Şifremi unuttum" — adres soruyor, sonra postaya yolluyor.
 *
 * ⚠ GÖNDERİLDİ EKRANI, adresin kayıtlı olup olmadığına BAKMADAN geliyor.
 * Sunucu da her zaman başarı döndürüyor (`requestPasswordReset`). Aksi hâlde
 * bu form bir kullanıcı sayma aracına dönüşürdü: adresi yazıp cevaba bakmak
 * "bu kişinin hesabı var mı" sorusunu yanıtlardı. Girişteki tek mesaj
 * kuralının aynısı — fark yalnızca posta kutusunda.
 */
export function ForgotCard({
  pending = false,
  onSend,
  onBack,
}: {
  pending?: boolean;
  onSend: (email: string) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <Card width={440}>
        <BackLink label="back to the meadow" onClick={onBack} />

        <div className="card-intro">
          <h2 className="card-title card-title--lead">Check your inbox</h2>
          <p className="body-text">
            If {email || 'that address'} has an account, a link is on its way.
          </p>
        </div>

        <p className="note note--center">
          the link lasts an hour · your old password works until you use it
        </p>
      </Card>
    );
  }

  return (
    <Card width={440}>
      <BackLink label="back to sign in" onClick={onBack} />

      <div className="card-intro">
        <h2 className="card-title card-title--lead">A new password</h2>
        <p className="body-text">
          Tell us the address you signed up with and we will send a link.
        </p>
      </div>

      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.includes('@') || pending) return;
          onSend(email);
          setSent(true);
        }}
      >
        <Field
          label="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Button
          size="md"
          type="submit"
          fullWidth
          disabled={!email.includes('@') || pending}
        >
          {pending ? 'Sending…' : 'Send the link'}
        </Button>
      </form>
    </Card>
  );
}

/**
 * Postadaki bağlantının indiği ekran: yeni şifre.
 *
 * ⚠ İKİNCİ BİR "tekrar yaz" ALANI YOK. Alanın göz düğmesi zaten var; ikinci
 * alan onun çözdüğü sorunu ikinci kez çözerdi ve formu uzatırdı.
 *
 * Token bu ekrana hiç GELMİYOR — `httpOnly` bir çerezde duruyor ve sunucu onu
 * kendisi okuyor. Kart yalnızca şifreyi gönderiyor.
 */
export function ResetCard({
  pending = false,
  expired = false,
  onSubmit,
  onBack,
}: {
  pending?: boolean;
  /** Bağlantı gönderim anında ölmüş — süresi geçmiş ya da kullanılmış. */
  expired?: boolean;
  onSubmit: (password: string) => void;
  onBack: () => void;
}) {
  const [password, setPassword] = useState('');

  const short = password.length > 0 && password.length < PASSWORD_MIN;
  const canSubmit = password.length >= PASSWORD_MIN && !pending && !expired;

  return (
    <Card width={440}>
      <BackLink label="back to the meadow" onClick={onBack} />

      <div className="card-intro">
        <h2 className="card-title card-title--lead">Set a new password</h2>
        <p className="body-text">
          Once it is saved you are in, and anywhere else you were signed in is
          signed out.
        </p>
      </div>

      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onSubmit(password);
        }}
      >
        <PasswordField
          label="new password"
          autoComplete="new-password"
          placeholder={`at least ${PASSWORD_MIN} characters`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={short}
          /*
           * Uzunluk kuralı SÜREKLİ yazılı ve kısa yazınca uyarı rengine
           * geçiyor — kayıt sekmesindeki kalıbın aynısı (`SignInCard`).
           */
          note={`at least ${PASSWORD_MIN} characters`}
          noteDanger={short}
        />

        {/*
         * ⚠ Bu not YALNIZCA bağlantı gönderim anında ölmüşse çıkıyor.
         *
         * Ölü bir bağlantıya tıklayan buraya hiç gelmiyor — sessizce çayıra
         * düşüyor (bkz. `/auth/confirm`). Buraya gelip de bunu görmek, formu
         * doldururken bağlantının süresinin dolması demek; kullanıcının
         * gerçekten bilmesi gereken tek durum.
         */}
        {expired ? (
          <p className="note note--center note--danger" role="alert">
            that link has expired · ask for a new one
          </p>
        ) : null}

        <Button size="md" type="submit" fullWidth disabled={!canSubmit}>
          {pending ? 'Saving…' : 'Enter the meadow'}
        </Button>
      </form>
    </Card>
  );
}
