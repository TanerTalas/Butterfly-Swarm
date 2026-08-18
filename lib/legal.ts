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
 * değiştirilmesi gerekiyor. Özellikle "How long" bölümü bir söz veriyor:
 * yedi günü dolan kelebek kaydının silindiği. O sözü tutan zamanlanmış
 * görev yazılmadan bu metin yayına çıkmamalı.
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
    updated: 'last updated 18 august 2026',
    sections: [
      {
        heading: 'What we keep',
        body: 'If you release a butterfly as a guest, we store the butterfly itself and nothing about you. If you have an account, we store your email address, the name and colour you chose for your profile, and the butterflies you have released.',
      },
      {
        heading: 'Why',
        body: 'The email address is how you sign back in. The profile name and colour appear next to your own butterflies. The butterfly records are what let you see how long each one has left to fly.',
      },
      {
        heading: 'How long',
        body: 'A butterfly record is removed once its seven days are over. Deleting your account removes your profile and every butterfly attached to it at once. The only thing that outlives either is the count of how many butterflies have been released, which is a single number and is not attached to anyone.',
      },
      {
        heading: 'Third parties',
        body: 'The site is hosted on Vercel, the database and sign-in are provided by Supabase, and bot checks are done by Cloudflare. Each of them sees the technical information needed to do its job, such as your IP address, and nothing more.',
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
    updated: 'last updated 18 august 2026',
    sections: [
      {
        heading: 'Account',
        body: 'One account per person. You are responsible for keeping your password to yourself. We may suspend an account that is being used to abuse the release endpoint or to work around the limits below.',
      },
      {
        heading: 'Butterflies',
        body: 'A butterfly flies for seven days and then leaves. This is not a bug and it cannot be extended, paused or reversed. Members can have five butterflies in the meadow at a time; a slot opens as each one finishes.',
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
    updated: 'last updated 18 august 2026',
    sections: [
      {
        heading: 'Necessary',
        body: 'If you sign in, one cookie keeps you signed in. Without it there is no way to know which butterflies are yours. It cannot be turned off while you are signed in, and it goes away when you sign out.',
      },
      {
        heading: 'Preferences',
        body: 'We remember nothing else about your visit. Wing colours, camera position and everything else are recalculated each time the page loads.',
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
    updated: 'last updated 18 august 2026',
    form: true,
    sections: [
      {
        heading: 'Write to us',
        body: 'Questions about your account, a butterfly that is behaving strangely, or a request to see or delete your data. All of it comes to the same place.',
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
