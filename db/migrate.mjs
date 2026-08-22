import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/*
 * Göç çalıştırıcısı.
 *
 *   npm run migrate
 *
 * `psql` gerektirmiyor — zaten kurulu olan `pg` ile çalışıyor. Bağlantı dizesi
 * `DATABASE_URL`den geliyor; npm betiği `.env.local`ı Node'un kendi
 * `--env-file`ıyla yüklüyor, yani `dotenv` gibi bir bağımlılık da yok.
 *
 * ⚠ Sağlayıcıya ait hiçbir şey yok. Neon, yerel bir Postgres, başka bir yer —
 * hepsinde aynı çalışır. Bu, kimliği kendimiz yazmamızın sebebiyle aynı sebep
 * (bkz. lib/server/db.ts).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, 'migrations');

/*
 * Uygulanmışların defteri.
 *
 * Dosyalar zaten `if not exists` kullanıyor, yani ikinci kez çalışmaları
 * zararsız. Defter yine de gerekli: onsuz "bu göç uygulandı mı" sorusunun
 * cevabı yok ve ikinci dosya geldiğinde (E.2 — salma fonksiyonu) o soru gerçek
 * bir soru oluyor.
 *
 * Şemayı burada açıyoruz, çünkü defter `garden` şemasında duruyor ama şemayı
 * kuran şey ilk göçün kendisi — tavuk-yumurta. İkisi de `if not exists`.
 */
const LEDGER = `
  create schema if not exists garden;
  create table if not exists garden.migration (
    name        text primary key,
    applied_at  timestamptz not null default now()
  );
`;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      'DATABASE_URL yok.\n' +
        '.env.example dosyasını .env.local olarak kopyalayıp Postgres bağlantı\n' +
        'dizesini doldur (Neon → Connect → pooled).',
    );
    process.exit(1);
  }

  const files = (await readdir(MIGRATIONS))
    .filter((f) => f.endsWith('.sql'))
    // İsim sırası UYGULAMA sırası: dosyalar `0001_`, `0002_` diye numaralı.
    .sort();

  if (files.length === 0) {
    console.log('Uygulanacak göç yok.');
    return;
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query(LEDGER);

    const { rows } = await client.query('select name from garden.migration');
    const applied = new Set(rows.map((r) => r.name));

    let ran = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`· ${file} — zaten uygulanmış, atlanıyor`);
        continue;
      }

      const sql = await readFile(join(MIGRATIONS, file), 'utf8');

      /*
       * ⚠ Her dosya TEK İŞLEMDE. Postgres DDL'i de geri alabiliyor, yani bir
       * göç ortasında patlarsa yarım uygulanmış bir şema kalmıyor — ya hepsi
       * ya hiçbiri. Defter satırı da aynı işlemin içinde: uygulanmamış bir
       * göçün "uygulandı" yazması mümkün değil.
       */
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into garden.migration (name) values ($1)', [
          file,
        ]);
        await client.query('commit');
        console.log(`✓ ${file}`);
        ran += 1;
      } catch (error) {
        await client.query('rollback');
        console.error(`✗ ${file} — uygulanamadı, geri alındı\n`);
        throw error;
      }
    }

    console.log(
      ran === 0 ? '\nHer şey güncel.' : `\n${ran} göç uygulandı.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
