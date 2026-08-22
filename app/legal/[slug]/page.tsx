import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from '@/components/ui/Icons';
import { ContactForm } from '@/components/legal/ContactForm';
import { LEGAL_PAGES, findLegalPage } from '@/lib/legal';

/*
 * Ekran 13 — yasal sayfalar.
 *
 * Sitedeki TEK gerçek rotalar bunlar. Çayır burada yok: sayfa düz krem,
 * içerik sabit genişlikte bir çerçevede. Sebebi hem teknik hem niyet —
 * biri gizlilik metnini okumaya geldiyse arkada uçuşan kelebek istemez,
 * ve bu sayfaların yazdırılabilir ve bağlanabilir olması gerekiyor.
 *
 * Dört sayfa da aynı bileşen: içerik `lib/legal.ts` içinde veri olarak
 * duruyor (bkz. oradaki not).
 */

export function generateStaticParams() {
  return LEGAL_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = findLegalPage(slug);
  return { title: page ? page.title + ' · Butterfly Garden' : 'Not found' };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = findLegalPage(slug);
  if (!page) notFound();

  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link href="/" className="legal-wordmark">
            Butterfly Garden
          </Link>
          <Link href="/" className="back-link">
            <ArrowLeft />
            back to the meadow
          </Link>
        </div>
      </header>

      <div className="legal-body">
        <nav className="legal-nav">
          {/*
           * Geçerli sayfa `aria-current` taşıyor ve stili buradan değil
           * CSS'ten geliyor (`legal.css`): işaret hem erişilebilirlik hem
           * görünüm için tek yerde duruyor.
           */}
          {LEGAL_PAGES.map((p) => (
            <Link
              key={p.slug}
              href={`/legal/${p.slug}`}
              aria-current={p.slug === page.slug ? 'page' : undefined}
              className="legal-nav-link"
            >
              {p.navLabel}
            </Link>
          ))}
        </nav>

        <main className="legal-main">
          <div className="legal-title-block">
            <h1 className="legal-title">{page.title}</h1>
            <p className="stamp">{page.updated}</p>
          </div>

          {page.sections.map((s) => (
            <section key={s.heading} className="legal-section">
              <h2 className="legal-section-heading">{s.heading}</h2>
              <p className="legal-section-body">{s.body}</p>
            </section>
          ))}

          {/*
           * ⚠ Turnstile'ın SİTE anahtarı buradan geçiyor, `NEXT_PUBLIC_` bir
           * değişkenden değil: bu sayfa zaten bir Server Component ve projede
           * `NEXT_PUBLIC_` bir değişken bulunmuyor (CLAUDE.md). Gizli anahtar
           * bambaşka bir değer ve yalnızca sunucuda (`lib/server/turnstile.ts`).
           *
           * `||` kullanılıyor, `??` DEĞİL: `.env`de boş bırakılmış bir satır
           * değişkeni tanımsız değil BOŞ STRING yapıyor ve boş anahtarla
           * çizilen widget hiç yüklenmezdi (aynı tuzak: `email.ts` → `appUrl`).
           */}
          {page.form && (
            <ContactForm siteKey={process.env.TURNSTILE_SITE_KEY || null} />
          )}
        </main>
      </div>
    </div>
  );
}
