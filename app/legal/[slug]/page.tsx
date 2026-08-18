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
    <div className="min-h-dvh bg-cream">
      <header className="border-b border-[rgba(44,34,32,0.12)]">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-6 py-5 lg:px-8">
          <Link href="/" className="font-display text-[22px] text-ink">
            Butterfly Garden
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 font-mono text-[12px] tracking-[0.14em] text-accent transition-opacity hover:opacity-70"
          >
            <ArrowLeft />
            back to the meadow
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1120px] flex-col gap-10 px-6 py-10 lg:flex-row lg:gap-16 lg:px-8 lg:py-14">
        <nav className="flex shrink-0 flex-col gap-3 lg:w-[200px]">
          {LEGAL_PAGES.map((p) => {
            const current = p.slug === page.slug;
            return (
              <Link
                key={p.slug}
                href={`/legal/${p.slug}`}
                aria-current={current ? 'page' : undefined}
                className={`text-[14px] transition-colors ${
                  current
                    ? 'font-semibold text-ink'
                    : 'text-muted hover:text-body'
                }`}
              >
                {p.navLabel}
              </Link>
            );
          })}
        </nav>

        <main className="flex max-w-[620px] flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-[32px] leading-tight text-ink lg:text-[40px]">
              {page.title}
            </h1>
            <p className="font-mono text-[11px] tracking-[0.14em] text-faint">
              {page.updated}
            </p>
          </div>

          {page.sections.map((s) => (
            <section key={s.heading} className="flex flex-col gap-2">
              <h2 className="text-[15px] font-semibold text-ink">
                {s.heading}
              </h2>
              <p className="text-[15px] leading-[1.65] text-body">{s.body}</p>
            </section>
          ))}

          {page.form && <ContactForm />}
        </main>
      </div>
    </div>
  );
}
