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
 * Buradaki her cümle bir davranış taahhüdü ve ürün onu tutmak zorunda. Üç
 * çelişki bulunup düzeltildi; üçü de aynı türdendi — metin, ürünün yapmadığı
 * (ya da yapacağı) bir şeyi söylüyordu:
 *
 *   1. "How long" yedi günü dolan kelebek kaydının SİLİNDİĞİNİ söylüyordu,
 *      oysa History ekranı tam olarak o kayıtları listeliyor. Silme sözü
 *      verip bir liste göstermek mümkün değil.
 *   2. "What we keep" misafirin çerezinden hiç bahsetmiyordu. Günlük sınır
 *      ÇEREZLE tutuluyor (bkz. EKSIKLER §1.2) ve bir çerez, kullanıldığı yerde
 *      yazılmak zorunda — hem gizlilik hem çerez metninde.
 *   3. "Preferences" tarayıcıda hiçbir şey saklanmadığını söylüyordu.
 *      Yarım kalmış kelebek artık `sessionStorage`da duruyor
 *      (`lib/draft.ts`).
 *
 * ⚠ Yeni bir davranış eklerken BU DOSYAYA dön. Taslak koruması eklendiğinde
 * çerez metni bir turdur yanlıştı ve bunu kimse fark etmemişti.
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
    updated: 'last updated 21 august 2026',
    sections: [
      {
        heading: 'What we keep',
        body: 'If you release a butterfly as a guest, we store the butterfly itself and nothing about you. The one-a-day limit is kept in a cookie in your own browser, not in a record here. If you have an account, we store your email address, the name and colour you chose for your profile, and the butterflies you have released.',
      },
      {
        heading: 'Why',
        body: 'The email address is how you sign back in. The profile name and colour appear next to your own butterflies. The butterfly records are what let you see how long each one has left to fly.',
      },
      {
        heading: 'How long',
        body: 'After seven days a butterfly stops flying, and what is left of it is a line in your own history: the name you gave it and the day you released it. Its colours and its place in the meadow are gone. That line stays until you delete your account, which removes your profile and every butterfly attached to it at once and for good; there is no recovery period. The only thing that outlives either is the count of how many butterflies have been released, which is a single number and is not attached to anyone.',
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
    updated: 'last updated 21 august 2026',
    sections: [
      {
        heading: 'Necessary',
        body: 'If you sign in, one cookie keeps you signed in. Without it there is no way to know which butterflies are yours. It cannot be turned off while you are signed in, and it goes away when you sign out. A second cookie remembers that a guest has let a butterfly go today, which is how the one-a-day limit works. It holds a date and nothing else, and it expires by itself.',
      },
      {
        heading: 'Preferences',
        body: 'One thing is kept in your browser and never sent to us: a butterfly you have started but not released yet, so that reloading the page does not lose the colours and the name you chose. It lives in the tab and disappears when you close it or when the butterfly goes. Nothing else is remembered — the camera position and everything else are recalculated each time the page loads.',
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
