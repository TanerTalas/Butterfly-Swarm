/*
 * Yasal sayfaların içeriği — VERİ olarak.
 *
 * Handoff bunu açıkça istiyor: metin JSX içine gömülmemeli. Sebebi pratik —
 * bu kopya avukat incelemesinden geçtikten sonra bütünüyle değişecek ve o
 * değişikliği yapan kişinin React bilmesi gerekmemeli. Şu an düz veri;
 * ileride MDX veya bir CMS'e taşınırsa yalnızca bu dosyanın kaynağı değişir,
 * sayfa bileşeni aynı kalır.
 *
 * ⚠ BU METİN YER TUTUCU. Ürünün gerçek davranışına göre sade bir dille
 * yazıldı ama hukuki metin DEĞİL. KVKK ve GDPR uyumlu sürümleriyle
 * değiştirilmesi gerekiyor.
 *
 * ── Metin ÜRÜNÜN sözü ─────────────────────────────────────────────────────
 *
 * Buradaki her cümle bir davranış taahhüdü ve ürün onu tutmak zorunda. Ürün
 * her büyüdüğünde metin geride kalıyor ve fark hep aynı türden oluyor: metin,
 * ürünün yapmadığı (ya da artık başka türlü yaptığı) bir şeyi söylüyor.
 * Bugüne kadar yakalananlar:
 *
 *   1. "How long" yedi günü dolan kelebek kaydının SİLİNDİĞİNİ söylüyordu,
 *      oysa History ekranı tam olarak o kayıtları listeliyor.
 *   2. "What we keep" misafirin çerezinden hiç bahsetmiyordu.
 *   3. "Preferences" tarayıcıda hiçbir şey saklanmadığını söylüyordu; yarım
 *      kalmış kelebek `sessionStorage`da duruyor (`lib/draft.ts`).
 *   4. "Preferences" bu kez de TEK bir şey saklandığını söylüyordu: kapatılan
 *      sahne şeridi ikinci bir kayıt (`lib/dismissed.ts`).
 *   5. "Third parties" kimliğin SUPABASE'te olduğunu söylüyordu. Kimlik
 *      kendi yazdığımız ve düz Postgres üstünde (`db/migrations/`); şifre
 *      kendi veritabanımızın dışına hiç çıkmıyor.
 *   6. İletişim formu hiçbir yere göndermiyordu. Artık mesaj hem postayla
 *      gidiyor hem tabloda duruyor ve yanında IP'nin ÖZETİ tutuluyor
 *      (`db/migrations/0002_contact.sql`) — saklanan yeni bir şey, buraya
 *      yazılmadan eklenemez.
 *   7. Rengi silen zamanlanmış iş yoktu: "renk gidiyor" sözü yalnızca
 *      sorguların o sütunu seçmemesiyle tutuluyor görünüyordu. Artık
 *      gerçekten siliniyor (`app/api/cron/sweep`) ve metin "bir gün içinde"
 *      diyor, çünkü iş günde bir kez dönüyor.
 *   8. "Third parties" postanın RESEND'den gittiğini söylüyordu. Resend
 *      doğrulanmış bir alan adı olmadan yalnızca kendi hesap sahibine teslim
 *      ediyor (403), yani kayıt akışı herkese kapalıydı; posta artık düz
 *      SMTP ile Google'ın sunucularından gidiyor (`lib/server/email.ts`).
 *      ⚠ Sağlayıcı yine değişebilir — katman genel SMTP ve konak bir ortam
 *      değişkeni; değiştiğinde bu cümle de değişmeli.
 *
 * ⚠ Yeni bir davranış eklerken BU DOSYAYA dön.
 *
 * ⚠ Hesap silme KALICI ve geri alma penceresi YOK. Bu bir varsayım değil:
 * arayüz üç yerde birden söz veriyor — ayarlardaki not ("cannot be brought
 * back"), butonun kendisi ("Delete for good") ve aşağıdaki "at once". Bir
 * geri alma penceresi eklenecekse üçünün de birlikte değişmesi gerekir.
 */

export type LegalSection = { heading: string; body: string };

export type LegalPage = {
  slug: string;
  navLabel: string;
  title: string;
  updated: string;
  sections: LegalSection[];
  /** Yalnızca iletişim sayfasında: altına form ekleniyor. */
  form?: boolean;
};

export const LEGAL_PAGES: LegalPage[] = [
  {
    slug: 'privacy',
    navLabel: 'Privacy Policy',
    title: 'Privacy Policy',
    updated: 'last updated 22 august 2026',
    sections: [
      {
        heading: 'What we keep',
        body: 'If you release a butterfly as a guest, we store the butterfly and nothing about you: two colours, a number that decides how it looks and flies, and the day it was let go. The one-a-day limit is kept in a cookie in your own browser, not in a record here. If you have an account, we store your email address, your password as a hash that cannot be read back, the name and colour you chose for your profile, the day you joined, and the butterflies you have released. If you write to us from the contact page, we store the message together with the name and address you typed, and a one-way fingerprint of the address the request came from — not the address itself.',
      },
      {
        heading: 'Why',
        body: 'The email address is how you sign back in, and how we answer you. The password is never kept as you typed it; what we hold cannot be turned back into it. The profile name and colour appear next to your own butterflies. The butterfly records are what let you see how long each one has left to fly. The fingerprint on a message is only ever compared with other fingerprints, so that the form cannot be flooded from one place; it cannot be turned back into an address either.',
      },
      {
        heading: 'How long',
        body: 'After seven days a butterfly stops flying. If it came from an account, what is left of it is a line in your own history: the name you gave it and the day you released it. Its colours and its place in the meadow are erased within a day. A butterfly released by a guest leaves nothing at all — the record itself goes. Your history stays until you delete your account, which removes your profile, your history and every butterfly attached to it at once and for good, and ends every session you have open; there is no recovery period. A message you have sent us is kept so that we can answer it, and if you delete your account it stays without being attached to anyone. The only thing that outlives all of this is the number on the meadow counter, which did not begin at zero and belongs to no one.',
      },
      {
        heading: 'Where it lives',
        body: 'The site runs on Vercel, and the database is an ordinary Postgres hosted by Neon in Frankfurt. Email is sent through Google’s mail servers. The check that tells people from scripts on the contact form is Cloudflare’s. Signing in is ours: there is no third-party identity provider, and your password never leaves our own database. Each of these services sees the technical information it needs to do its job, such as your IP address, and nothing more.',
      },
      {
        heading: 'Your rights',
        body: 'You can ask for a copy of what we hold about you, ask us to correct it, or delete your account yourself from Settings at any time. Write to us on the contact page and we will answer.',
      },
    ],
  },
  {
    slug: 'terms',
    navLabel: 'Terms of Use',
    title: 'Terms of Use',
    updated: 'last updated 22 august 2026',
    sections: [
      {
        heading: 'Account',
        body: 'One account per person. An address has to be confirmed by email before it can sign in, and you are responsible for keeping your password to yourself. If you forget it, the link on the sign-in card sets a new one and ends every session that was open at the time. We may suspend an account that is being used to abuse the release endpoint or to work around the limits below.',
      },
      {
        heading: 'Butterflies',
        body: 'A butterfly flies for seven days and then leaves. This is not a bug and it cannot be extended, paused or reversed. Members can have five butterflies in the meadow at a time; a slot opens as each one finishes. The meadow itself holds a fixed number, so there are moments when it has no room and a release has to wait.',
      },
      {
        heading: 'Names',
        body: 'You may name the butterflies you release. Names are yours alone to see, on your own account page. Even so, we may remove a name that is unlawful, and we may remove an account that repeatedly submits them.',
      },
      {
        heading: 'Availability',
        body: 'This is a small site run for pleasure. It may be slow, it may be down, and it may change. We do not promise that a butterfly you released will be visible at any particular moment.',
      },
    ],
  },
  {
    slug: 'cookies',
    navLabel: 'Cookie Policy',
    title: 'Cookie Policy',
    updated: 'last updated 22 august 2026',
    sections: [
      {
        heading: 'Necessary',
        body: 'If you sign in, one cookie keeps you signed in. Without it there is no way to know which butterflies are yours. It cannot be turned off while you are signed in, and it goes away when you sign out. A second cookie remembers that a guest has let a butterfly go today, which is how the one-a-day limit works. It holds a date and nothing else, and it expires by itself. A third one appears only when you follow a password reset link, and only for a quarter of an hour: it carries the token from that link so the token never has to sit in the address bar, and it is dropped as soon as the new password is set. None of the three can be read by scripts running in the page.',
      },
      {
        heading: 'The bot check',
        body: 'Before a message from the contact form reaches us, Cloudflare checks that a person filled the form in. That check runs in the page and may keep a token of its own in your browser to tell people apart from scripts. It is on the contact page and nowhere else, and it is not used to follow you between sites.',
      },
      {
        heading: 'Preferences',
        body: 'Two things are kept in your browser and never sent to us: a butterfly you have started but not released yet, so that reloading the page does not lose the colours and the name you chose, and the fact that you have dismissed the notice shown when the meadow cannot be drawn. Both live in the tab and disappear when you close it. Nothing else is remembered — the camera position and everything else are recalculated each time the page loads.',
      },
      {
        heading: 'Measurement',
        body: 'We do not use advertising or cross-site tracking cookies. If we ever add a way of counting visits, it will be one that does not identify you, and this section will say so before it is turned on.',
      },
    ],
  },
  {
    slug: 'contact',
    navLabel: 'Contact',
    title: 'Contact',
    updated: 'last updated 22 august 2026',
    form: true,
    sections: [
      {
        heading: 'Write to us',
        body: 'Questions about your account, a butterfly that is behaving strangely, or a request to see or delete your data. All of it comes to the same place.',
      },
      {
        heading: 'What happens to it',
        body: 'Your message is sent to our inbox and kept here as well, so that a failure at the mail provider cannot lose it. It carries the name and address you type below; if you are signed in it also carries which account you are signed in as, and that is the only part of it we can be sure of. A one-way fingerprint of your address is stored beside it, so that the form cannot be flooded from one place.',
      },
      {
        heading: 'Response time',
        body: 'Usually within a few days. Requests about your own data are answered within thirty days at the latest, as the law requires.',
      },
    ],
  },
];

export function findLegalPage(slug: string): LegalPage | undefined {
  return LEGAL_PAGES.find((p) => p.slug === slug);
}
