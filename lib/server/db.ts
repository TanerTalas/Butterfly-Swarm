import { Pool, type QueryResultRow } from 'pg';

/*
 * Postgres bağlantısı — YALNIZCA SUNUCUDA.
 *
 * ⚠ TARAYICI VERİTABANIYLA HİÇ KONUŞMUYOR ve konuşmamalı. Bütün okuma ve yazma
 * Server Action ya da Route Handler içinden geçiyor; bu yüzden hiçbir ortam
 * değişkeni `NEXT_PUBLIC_` değil ve olmayacak.
 *
 * Sağlayıcıya ait hiçbir şey yok: düz `pg`, düz bağlantı dizesi. Neon,
 * Supabase'in Postgres'i, yerel bir kurulum — hepsinde aynı. Bir sağlayıcının
 * kendi sürücüsüne (`@neondatabase/serverless` gibi) geçmek hızlı olurdu ama
 * taşınabilirliği verirdi ve barındırma kararının ertelenebilmesi bu projede
 * o hızdan daha değerli.
 */

declare global {
  // eslint-disable-next-line no-var
  var __gardenPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL tanımlı değil. .env.example dosyasını .env.local olarak ' +
        'kopyalayıp Postgres bağlantı dizesini doldur.',
    );
  }

  return new Pool({
    connectionString,

    /*
     * ⚠ `search_path` BAĞLANTIDA kuruluyor, sorgularda değil. Sebebi şema
     * seçiminin tek yerde kalması: tablolar `garden` şemasında ve sorgular
     * onları çıplak isimle çağırıyor (`select … from account`). Paylaşılan bir
     * veritabanına düşmek gerekirse değişen tek şey bu satır.
     */
    options: '-c search_path=garden,public',

    /*
     * Sunucusuz ortamda her örnek kendi havuzunu açıyor; havuz büyük olursa
     * veritabanının bağlantı tavanı örnek sayısıyla çarpılıyor. Küçük tutuluyor
     * ve bağlantı havuzlayıcısı (pooler) uç noktası kullanılıyor.
     */
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

/*
 * Havuz `globalThis` üstünde saklanıyor.
 *
 * Geliştirmede Next her dosya değişiminde modülleri yeniden yükletiyor; havuz
 * modül kapsamında dursaydı her kaydetmede yenisi açılır, eskisi bağlantıları
 * tutmaya devam eder ve birkaç dakika sonra veritabanı bağlantı tavanına
 * çarpardı.
 */
export function pool(): Pool {
  if (!globalThis.__gardenPool) globalThis.__gardenPool = createPool();
  return globalThis.__gardenPool;
}

/**
 * Parametreli sorgu. Satırları döndürür.
 *
 * ⚠ `values` DIŞINDA hiçbir şey sorguya girmiyor. SQL'i string birleştirmeyle
 * kurma — `pg` parametreleri sunucu tarafında bağlıyor ve enjeksiyona kapalı
 * olmanın tek yolu bu.
 */
export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await pool().query<T>(text, values);
  return result.rows;
}

/** Tek satır bekleyen sorgu; satır yoksa `null`. */
export async function queryOne<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, values);
  return rows[0] ?? null;
}

/**
 * Birden çok yazmayı tek işlemde toplar.
 *
 * Salma bunu isteyecek (E.2): kontenjan sayımı ile eklemenin arasına başka bir
 * istek giremezse tavan aşılmıyor. Bugün kayıt akışı kullanıyor — hesap ve
 * doğrulama token'ı ya birlikte yazılıyor ya hiç.
 */
export async function transaction<T>(
  run: (q: typeof query) => Promise<T>,
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('begin');

    const scoped = async <R extends QueryResultRow>(
      text: string,
      values: unknown[] = [],
    ): Promise<R[]> => (await client.query<R>(text, values)).rows;

    const result = await run(scoped as typeof query);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
