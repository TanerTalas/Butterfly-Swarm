import { query } from '@/lib/server/db';
import type { Butterfly, MeadowEntry } from '@/lib/types';
import { WORLD } from '@scene/world/config.js';

/*
 * Çayırın ve kişisel listelerin okunması (Aşama E.3).
 *
 * Üç ayrı soru, üç ayrı sorgu — ve üçü aynı tabloya farklı gözlerle bakıyor:
 *
 *   readMeadow        çayırda ŞU AN ne uçuyor (herkesin, isimsiz)
 *   readOwnLive       BENİM uçan kelebeklerim (isimli, renkli)
 *   readOwnHistory    BENİM ömrünü tamamlamışlarım (yalnızca isim ve tarih)
 */

/** `bigint` sürücüden string geliyor; tohum 32 bitlik ve sayıya sığıyor. */
function toSeed(value: string | null): number {
  return value === null ? 0 : Number(value);
}

/**
 * Çayırda uçan her kelebek — kimin olduğuna bakmadan.
 *
 * ⚠ İSİM ve SAHİP SEÇİLMİYOR. Sahne isim çizmiyor ve bu liste herkese
 * gidiyor; sorguya `name` eklemek, birinin kelebeğine verdiği ismi bütün
 * ziyaretçilere açmak olurdu.
 *
 * ⚠ Kontenjan burada da uygulanıyor (`limit`). Salma zaten tavanı koruyor,
 * yani normalde bir şey kırpılmıyor; ama sahnenin bloğu sabit boyutlu ve
 * fazlası "uçmayan ama çizilen" kelebek demek. En YENİLER kalıyor: tavan bir
 * şekilde aşılmışsa düşecek olan, ömrünün sonuna en yakın olan.
 */
export async function readMeadow(): Promise<MeadowEntry[]> {
  try {
    const rows = await query<{
      id: string;
      fore_hex: string;
      hind_hex: string;
      seed: string;
      released_at: Date;
      expires_at: Date;
      is_guest: boolean;
    }>(
      `(select id, fore_hex, hind_hex, seed, released_at, expires_at,
               true as is_guest
          from garden.butterfly
         where owner_id is null
           and fore_hex is not null
           and expires_at > now()
         order by released_at desc
         limit $1)
       union all
       (select id, fore_hex, hind_hex, seed, released_at, expires_at,
               false as is_guest
          from garden.butterfly
         where owner_id is not null
           and fore_hex is not null
           and expires_at > now()
         order by released_at desc
         limit $2)`,
      [WORLD.guestSlots, WORLD.memberSlots],
    );

    return rows.map((r) => ({
      id: r.id,
      foreHex: r.fore_hex,
      hindHex: r.hind_hex,
      seed: toSeed(r.seed),
      releasedAt: r.released_at,
      expiresAt: r.expires_at,
      kind: r.is_guest ? ('guest' as const) : ('member' as const),
    }));
  } catch {
    /*
     * Veritabanı susarsa çayır YERLEŞİKLERLE çiziliyor, sayfa çökmüyor.
     * `readSession` ve `readReleaseTotal` ile aynı karar: çayır kimliksiz de
     * çalışan bir yer ve boş bir çayır, hiç açılmayan bir sayfadan iyi.
     */
    return [];
  }
}

/** Üyenin şu an uçan kelebekleri — isimli ve renkli. */
export async function readOwnLive(accountId: string): Promise<Butterfly[]> {
  try {
    const rows = await query<{
      id: string;
      name: string | null;
      fore_hex: string;
      hind_hex: string;
      seed: string;
      released_at: Date;
    }>(
      `select id, name, fore_hex, hind_hex, seed, released_at
         from garden.butterfly
        where owner_id = $1
          and fore_hex is not null
          and expires_at > now()
        order by released_at`,
      [accountId],
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      foreHex: r.fore_hex,
      hindHex: r.hind_hex,
      seed: toSeed(r.seed),
      releasedAt: r.released_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Ömrünü tamamlamış kelebekler — YALNIZCA isim ve tarih.
 *
 * ⚠ Renk SEÇİLMİYOR ve bu bir tasarım tercihi değil, saklama kuralının
 * kendisi: gizlilik metni "renk ve çayırdaki yer gidiyor, isim ve tarih
 * geçmişte kalıyor" diyor. `HistoryCard` satırının sadeliği de aynı kuralın
 * görünen yüzü.
 *
 * Renk alanları boş string olarak dolduruluyor, çünkü `Butterfly` tipi onları
 * istiyor; ekranda hiçbiri okunmuyor.
 */
export async function readOwnHistory(accountId: string): Promise<Butterfly[]> {
  try {
    const rows = await query<{
      id: string;
      name: string | null;
      released_at: Date;
    }>(
      `select id, name, released_at
         from garden.butterfly
        where owner_id = $1
          and expires_at <= now()
        order by released_at desc`,
      [accountId],
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      foreHex: '',
      hindHex: '',
      releasedAt: r.released_at,
    }));
  } catch {
    return [];
  }
}
