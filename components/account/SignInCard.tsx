'use client';

import { useEffect, useRef, useState } from 'react';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, PasswordField, Segmented } from '@/components/ui/Field';
import { PASSWORD_MIN, type SignInError } from '@/lib/types';

/*
 * Ekran 04 — giriş / kayıt.
 *
 * Tek kart, iki sekme. Google butonu resmi dört renkli işareti SOLDA
 * taşıyor (handoff bunu açıkça yazıyor); marka işaretleri yeniden
 * renklendirilmiyor.
 *
 * ── D6: hata hâlleri ──────────────────────────────────────────────────────
 *
 * ⚠ TEK MESAJ: "email or password is wrong". Hangi alanın yanlış olduğu
 * SÖYLENMEZ — söylenirse e-postanın kayıtlı olup olmadığı ele verilir ve
 * kullanıcı sayımına izin verilmiş olur. Bu bir tasarım tercihi değil,
 * güvenlik kuralı.
 *
 * Bunun görsel sonucu var ve bilerek: hata çerçevesi İKİ ALANA birden
 * düşüyor. Yalnızca birini işaretlemek, mesajın söylemediğini renkle
 * söylemek olurdu.
 *
 * Yer: alanların ALTI, butonun ÜSTÜ. Alanların üstüne konsaydı yerleşim
 * aşağı kayıp kullanıcının bastığı düğme parmağının altından kaçardı.
 *
 * Ekran okuyucu: mesaj `role="alert"` taşıyor (örtük `aria-live=assertive`)
 * — kullanıcının kendi gönderiminin cevabı, yani kesintiye değer. Odak
 * şifre alanına taşınıyor: e-posta genelde doğru, yeniden yazılacak olan
 * şifre. Alan da temizleniyor, yoksa kullanıcı yanlış şifrenin üstüne
 * yazmaya çalışıyor.
 *
 * Hız sınırında buton KİLİTLENİYOR. Diğer iki hatada kilitlenmiyor: orada
 * tekrar denemek doğru davranış, burada tekrar denemek sınırı uzatıyor.
 */
export function SignInCard({
  onDone,
  onNeedsSetup,
  onBack,
  error,
  onAttempt,
  pending = false,
  status = 'idle',
}: {
  /*
   * ⚠ ŞİFRE KARTTAN ÇIKIYOR ve bu bilinçli bir imza.
   *
   * Sunucusuz sürümde yalnızca e-posta veriliyordu, çünkü şifreye bakan kimse
   * yoktu. Artık `signIn` action'ı ikisini birden istiyor. Şifre `Garden`da
   * SAKLANMIYOR — doğrudan action'a geçiriliyor ve orada kalıyor.
   */
  onDone: (email: string, password: string) => void;
  onNeedsSetup: (email: string, password: string) => void;
  onBack: () => void;
  /** Sunucunun reddi. `null` iken kart temiz. */
  error?: SignInError | null;
  /** Her gönderimde çağrılıyor — `Garden` önceki hatayı buradan siliyor. */
  onAttempt?: () => void;
  /**
   * İstek sürerken buton kilitli.
   *
   * Sunucusuz sürümde gerekmiyordu: cevap aynı karede geliyordu. Gerçek bir
   * gecikme varken kilitsiz buton iki kez basılabiliyor ve kayıt akışında bu
   * iki ayrı deneme demek.
   */
  pending?: boolean;
  /**
   * `verify`: kayıt alındı, e-posta doğrulaması bekleniyor.
   *
   * Artık gerçekten girilen bir hâl: `signUp` action'ı doğrulama postasını
   * gönderiyor ve bağlantı `/auth/confirm`e iniyor.
   */
  status?: 'idle' | 'verify';
}) {
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);

  const short = password.length > 0 && password.length < PASSWORD_MIN;
  const locked = error?.kind === 'rate-limit';
  const canSubmit =
    email.includes('@') &&
    password.length >= PASSWORD_MIN &&
    !locked &&
    !pending;

  /*
   * Hata GELDİĞİNDE şifreyi temizleyip odağı oraya taşı.
   *
   * `error` nesnesinin kimliğine bakılıyor, içeriğine değil: aynı hatayı
   * ikinci kez almak da bir olay ve alan yine temizlenmeli. `Garden` her
   * denemede `null`a çekip yeniden yazdığı için bu tetikleniyor.
   */
  useEffect(() => {
    if (!error || error.kind === 'rate-limit') return;
    setPassword('');
    passwordRef.current?.focus();
  }, [error]);

  if (status === 'verify') return <VerifyCard email={email} onBack={onBack} />;

  return (
    <Card width={440}>
      <BackLink label="back to the meadow" onClick={onBack} />

      <h2 className="card-title card-title--lead">Enter the meadow</h2>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'in', label: 'Sign in' },
          { value: 'up', label: 'Sign up' },
        ]}
      />

      {/*
       * GERÇEK <form>. Alanlar önce çıplak duruyordu ve Enter'a basmak
       * hiçbir şey yapmıyordu: gönderilecek bir form olmayınca tarayıcının
       * örtük gönderimi (implicit submission) devreye girmiyor.
       *
       * Form ayrıca şifre yöneticilerinin alanları bir giriş formu olarak
       * tanımasını sağlıyor; `autoComplete` ipuçları ancak form içinde tam
       * anlamıyla işe yarıyor.
       *
       * `.form-stack` kartın kendi satır aralığını tekrarlıyor: form artık
       * kartın tek bir flex çocuğu, olmasaydı alanlarla buton arasındaki
       * boşluk kapanırdı.
       */}
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onAttempt?.();
          if (tab === 'in') onDone(email, password);
          else onNeedsSetup(email, password);
        }}
      >
        <div className="field-group">
          {/*
           * `aria-invalid` İKİ ALANDA birden — mesaj hangisinin yanlış
           * olduğunu söylemiyor, çerçeve de söylememeli.
           */}
          <Field
            label="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={error?.kind === 'credentials'}
          />
          <PasswordField
            ref={passwordRef}
            label="password"
            autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
            placeholder={`at least ${PASSWORD_MIN} characters`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={error?.kind === 'credentials' || (tab === 'up' && short)}
            /*
             * Kayıt sekmesinde uzunluk kuralı SÜREKLİ yazılı, ve kullanıcı
             * kısa bir şifre yazdığında uyarı rengine geçiyor. Önce yalnızca
             * buton kilitleniyordu: kullanıcı neden gönderemediğini
             * göremiyordu.
             */
            note={tab === 'up' ? `at least ${PASSWORD_MIN} characters` : undefined}
            noteDanger={tab === 'up' && short}
          />
        </div>

        {error && <SignInAlert error={error} />}

        {/*
         * Formun VARSAYILAN düğmesi. Devre dışıyken Enter da formu
         * göndermiyor — tarayıcı örtük gönderimde bu düğmeyi arıyor.
         * Yani doğrulama tek yerde kalıyor, iki kez yazılmıyor.
         */}
        <Button size="md" type="submit" fullWidth disabled={!canSubmit}>
          {/*
           * Bekleme dili kartın kendi icadı değil: "Letting it go…" kalıbı
           * salma kartlarında kurulu (ulaç + üç nokta), buradaki onu izliyor.
           */}
          {locked
            ? 'Too many attempts'
            : pending
              ? tab === 'in'
                ? 'Signing in…'
                : 'Signing up…'
              : tab === 'in'
                ? 'Sign in'
                : 'Sign up'}
        </Button>
      </form>

      {/*
       * ⚠ HENÜZ BAĞLI DEĞİL ve bu yüzden devre dışı.
       *
       * Sunucusuz sürümde buton sahte bir e-postayla (`you@example.com`)
       * doğrudan hesap kurulumuna atlıyordu — gösterim iskelesiydi. Kimlik
       * gerçek olduğuna göre o yol artık var olmayan bir hesaba oturum açmaya
       * çalışırdı; çalışıyormuş gibi duran bir buton, kilitli duran bir
       * butondan daha kötü.
       *
       * Bağlanması Google OAuth akışını yazmak demek (~150 satır, kütüphane
       * gerekmiyor); ayrı bir iş olarak duruyor.
       */}
      <button type="button" disabled className="button--oauth">
        <GoogleMark />
        Continue with Google
      </button>

      {/*
       * Yasal metne giden bağlantı BURADA duruyor. Kabuğun alt şeridi
       * yalnızca çayır görünümlerinde çizildiği için (bkz. MeadowShell),
       * kullanıcının şartları görmesi gereken tek ekran kendi bağlantısını
       * taşımak zorunda.
       */}
      <p className="consent-note">
        by signing in you accept the <a href="/legal/terms">terms</a>
      </p>
    </Card>
  );
}

/*
 * Hata satırı. Kalıp "Kelebeklerim"deki dolu yuvanınkiyle aynı: bir
 * denetimin altında nedenini söyleyen tek satır not — yalnızca rengi
 * uyarıya dönüyor. Yeni bir kutu icat edilmedi.
 */
function SignInAlert({ error }: { error: SignInError }) {
  return (
    <p className="note note--center note--danger" role="alert">
      {error.kind === 'credentials'
        ? 'email or password is wrong'
        : error.kind === 'rate-limit'
          ? error.retryInSeconds
            ? `too many attempts · try again in ${error.retryInSeconds}s`
            : 'too many attempts · wait a moment before trying again'
          : 'that did not reach us · try again'}
    </p>
  );
}

/*
 * Kayıt alındı, e-posta doğrulaması bekleniyor.
 *
 * Ayrı bir EKRAN değil, aynı kartın bir hâli: başlık ve genişlik aynı, form
 * yerini tek bir bildirime bırakıyor. Buton yok — kullanıcının burada
 * yapabileceği bir şey yok, yapacağı şey posta kutusunda.
 */
function VerifyCard({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <Card width={440}>
      <BackLink label="back to the meadow" onClick={onBack} />

      <div className="card-intro">
        <h2 className="card-title card-title--lead">Check your inbox</h2>
        <p className="body-text">
          We sent a link to {email || 'your address'}. The meadow opens once
          you follow it.
        </p>
      </div>

      <p className="note note--center">
        the link lasts an hour · nothing is released until you are in
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
