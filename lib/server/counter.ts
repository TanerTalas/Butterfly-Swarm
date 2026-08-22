import { queryOne } from '@/lib/server/db';

/*
 * Küresel salma sayacı.
 *
 * ⚠ Kelebek sayısından TÜRETİLMİYOR, kendi satırında duruyor. İki sebep: ömrü
 * dolan kelebek çayırdan kalkıyor ama sayılmış olmaktan çıkmıyor, ve misafir
 * kontenjanı dolduğunda çayıra hiç girmeyen kelebek de sayılıyor (bkz.
 * CLAUDE.md — yem kelebek). `count(*)` ikisini de yanlış sayardı.
 */

const KEY = 'released_total';

/**
 * Sayacın şu anki değeri.
 *
 * Veritabanı cevap vermezse 0 dönüyor ve sayaç görünmüyor. Uydurma bir sayı
 * göstermek daha kötü olurdu: sayaç gizlilik metninde "kaç kelebek salındığı"
 * diye tarif ediliyor, yani doğru olmadığı anda bir taahhüdü bozuyor.
 */
export async function readReleaseTotal(): Promise<number> {
  try {
    const row = await queryOne<{ value: string }>(
      'select value from garden.counters where key = $1',
      [KEY],
    );

    // `bigint` sürücüden STRING olarak geliyor: 2^53'ü aşan bir sayı
    // `number`a sığmadığı için `pg` kaybı önlüyor. Sayaç o mertebeye
    // ulaşmayacak, ama dönüşüm yine de açıkça yapılıyor.
    return row ? Number(row.value) : 0;
  } catch {
    return 0;
  }
}
