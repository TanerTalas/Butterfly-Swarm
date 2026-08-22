'use server';

import { cookies } from 'next/headers';
import { transaction } from '@/lib/server/db';
import { readSession } from '@/lib/server/session';
import {
  GUEST_DAILY_LIMIT,
  NAME_MAX,
  SLOT_LIMIT,
  WING_COLOURS,
  expiresFrom,
  type Butterfly,
  type ReleaseFailure,
} from '@/lib/types';
import { WORLD } from '@scene/world/config.js';

/*
 * ── Salma (Aşama E.2) ─────────────────────────────────────────────────────
 *
 * Kuralların kendisi CLAUDE.md'de; burası onların uygulandığı yer.
 *
 * ⚠ Kontenjan sayıları BURADA YAZILI DEĞİL. `WORLD.guestSlots` /
 * `WORLD.memberSlots` sahnenin yapılandırmasından okunuyor ve `SLOT_LIMIT`
 * arayüzün tipinden. İkinci bir kopya, bir taraf değiştiğinde sunucunun
 * sessizce eski tavanla çalışması demekti.
 *
 * ⚠ Ömür de burada hesaplanmıyor: `expiresFrom` (lib/types.ts) çağrılıyor.
 * Bu yüzden salma bir Postgres fonksiyonu DEĞİL — SQL'e yazılsaydı yedi gün
 * kuralının ikinci bir kopyası veritabanında olurdu.
 */

export type ReleaseResult =
  | { ok: true; butterfly: Butterfly; total: number }
  | { ok: false; error: ReleaseFailure };

/**
 * İşlemin içinden çıkan şey: ya bir red, ya yazılmış satır.
 *
 * Açıkça tiplenmesi gerekiyor; yoksa TypeScript iki dalı tek bir nesnede
 * birleştiriyor ve `'failure' in result` daraltması çalışmıyor.
 */
type Outcome =
  | { failure: ReleaseFailure['kind'] }
  | { id: string; total: number };

/*
 * Kontenjan sayımını serileştiren kilit.
 *
 * ⚠ Sayma ile ekleme arasına başka bir salma girerse tavan aşılıyor: iki
 * sekme birden 119 üye görüp ikisi de ekleyince 121 oluyor. İşlem yalıtımı
 * tek başına bunu engellemiyor (READ COMMITTED'da ikisi de aynı anlık
 * görüntüyü okuyor), o yüzden salmalar bu kilitle sıraya giriyor.
 *
 * Maliyeti önemsiz: salma nadir bir olay ve kilit yalnızca işlem boyunca.
 */
const RELEASE_LOCK = 8_471_233;

/** Misafirin günlük hakkını taşıyan çerez. */
const GUEST_COOKIE = 'garden_guest';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 32 bitlik tohum — sahnenin `mulberry32`si bu genişlikte çalışıyor. */
function newSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

function isHex(value: string): boolean {
  return /^#[0-9A-F]{6}$/.test(value);
}

/**
 * Misafirin bugün kaç kelebek saldığı.
 *
 * ⚠ Çerez SİLİNEBİLİR ve bu kabul edilmiş bir şey (CLAUDE.md). Asıl koruma
 * misafir kontenjanının tavanı: çerezi silip defalarca salan biri çayırı
 * şişiremiyor, yalnızca sayacı artırıyor.
 */
async function guestReleasesToday(): Promise<number> {
  const raw = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!raw) return 0;

  const [date, count] = raw.split(':');
  if (date !== today()) return 0;

  const n = Number(count);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function noteGuestRelease(previous: number): Promise<void> {
  const store = await cookies();
  store.set(GUEST_COOKIE, `${today()}:${previous + 1}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Gün sonunda anlamını yitiriyor; iki gün fazlasıyla yeter.
    maxAge: 2 * 24 * 60 * 60,
  });
}

/**
 * Misafir salması.
 *
 * ⚠ RENK SUNUCUDA ÇEKİLİYOR. İstemcide olduğu sürece kullanıcı yeniden
 * deneyerek istediği rengi tutturabiliyordu; kartın sözü ise "The meadow
 * picks the wings". Tek renk: misafir ve yerleşik kelebekler paletten tek
 * renk geziyor, iki renkli kanat üyeye özel.
 */
export async function releaseAsGuest(): Promise<ReleaseResult> {
  try {
    const used = await guestReleasesToday();
    if (used >= GUEST_DAILY_LIMIT) {
      return { ok: false, error: { kind: 'guest-limit' } };
    }

    const colour = WING_COLOURS[Math.floor(Math.random() * WING_COLOURS.length)].hex;
    const releasedAt = new Date();
    const seed = newSeed();

    const result = await transaction(async (run) => {
      await run('select pg_advisory_xact_lock($1)', [RELEASE_LOCK]);

      const [{ live }] = await run<{ live: number }>(
        `select count(*)::int as live
           from garden.butterfly
          where owner_id is null
            and fore_hex is not null
            and expires_at > now()`,
      );

      /*
       * ⚠ Kontenjan doluysa salma REDDEDİLMİYOR — kelebek yalnızca çayıra
       * girmiyor (satır hiç yazılmıyor) ve sayaç yine artıyor.
       *
       * Sebebi güvenlik: reddetmek, çerezi silip tekrar deneyerek kaç
       * kelebeğin sığdığını ÖLÇÜLEBİLİR yapardı. Sessiz kalmak o geri
       * bildirimi kesiyor. Onay ekranındaki "Follow it in the meadow" boşa
       * düşmüyor: sahne kimliği sabit bir yerleşiğe eşliyor
       * (`visitors.js` → `DECOY_INDEX`).
       */
      const admitted = live < WORLD.guestSlots;

      let id = crypto.randomUUID();

      if (admitted) {
        const [row] = await run<{ id: string }>(
          `insert into garden.butterfly
             (owner_id, name, fore_hex, hind_hex, seed, released_at, expires_at)
           values (null, null, $1, $1, $2, $3, $4)
           returning id`,
          [colour, seed, releasedAt, expiresFrom(releasedAt)],
        );
        id = row.id;
      }

      const [{ value }] = await run<{ value: string }>(
        `update garden.counters set value = value + 1
          where key = 'released_total'
         returning value`,
      );

      return { id, total: Number(value) };
    });

    await noteGuestRelease(used);

    return {
      ok: true,
      total: result.total,
      butterfly: {
        id: result.id,
        name: null,
        foreHex: colour,
        hindHex: colour,
        releasedAt,
        seed,
      },
    };
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
}

/**
 * Üye salması.
 *
 * ⚠ İki red BİRBİRİNDEN AYRI ve öyle kalmalı: `slots-full` kullanıcının
 * kendi beş yuvası, `meadow-full` çayırın üye alanı. "Beş hakkını doldurdun"
 * demek, iki kelebeği olan birine yanlış olurdu.
 *
 * ⚠ Yem kelebek YALNIZCA MİSAFİRE. Üyenin kelebeği isimli, listelenir ve
 * takip edilir; ona başka bir kelebeği göstermek fark edilebilir bir yalan
 * olurdu. Bu yüzden burada red AÇIK.
 */
export async function releaseAsMember(
  name: string,
  foreHex: string,
  hindHex: string,
): Promise<ReleaseResult> {
  const trimmed = name.trim();

  /*
   * Arayüz üçünü de zaten kısıtlıyor; buradaki kontrol kuralın kendisi.
   * Geçersiz girdi `network` diline düşüyor — arayüzden ulaşılamayan bir yol
   * ve tasarımda "girdin geçersiz" diye çizilmiş bir hâl yok.
   */
  if (trimmed.length < 1 || trimmed.length > NAME_MAX) {
    return { ok: false, error: { kind: 'network' } };
  }
  if (!isHex(foreHex) || !isHex(hindHex)) {
    return { ok: false, error: { kind: 'network' } };
  }

  try {
    /*
     * ⚠ Sahip ÇEREZDEN geliyor, çağrıdan değil. İstemciden bir kimlik
     * alınsaydı herkes başkasının adına kelebek salabilirdi.
     */
    const session = await readSession();
    if (session.kind !== 'member') {
      return { ok: false, error: { kind: 'network' } };
    }

    const releasedAt = new Date();
    const seed = newSeed();

    const result = await transaction<Outcome>(async (run) => {
      await run('select pg_advisory_xact_lock($1)', [RELEASE_LOCK]);

      const [{ mine }] = await run<{ mine: number }>(
        `select count(*)::int as mine
           from garden.butterfly
          where owner_id = $1
            and fore_hex is not null
            and expires_at > now()`,
        [session.accountId],
      );
      if (mine >= SLOT_LIMIT) return { failure: 'slots-full' as const };

      const [{ live }] = await run<{ live: number }>(
        `select count(*)::int as live
           from garden.butterfly
          where owner_id is not null
            and fore_hex is not null
            and expires_at > now()`,
      );
      if (live >= WORLD.memberSlots) return { failure: 'meadow-full' as const };

      const [row] = await run<{ id: string }>(
        `insert into garden.butterfly
           (owner_id, name, fore_hex, hind_hex, seed, released_at, expires_at)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id`,
        [
          session.accountId,
          trimmed,
          foreHex,
          hindHex,
          seed,
          releasedAt,
          expiresFrom(releasedAt),
        ],
      );

      /*
       * Sayaç YALNIZCA gerçekten salındığında artıyor. Reddedilen bir salma
       * olmamış bir salmadır; sayaç gizlilik metninde "kaç kelebek salındığı"
       * diye tarif ediliyor.
       */
      const [{ value }] = await run<{ value: string }>(
        `update garden.counters set value = value + 1
          where key = 'released_total'
         returning value`,
      );

      return { id: row.id, total: Number(value) };
    });

    if ('failure' in result) {
      return { ok: false, error: { kind: result.failure } };
    }

    return {
      ok: true,
      total: result.total,
      butterfly: {
        id: result.id,
        name: trimmed,
        foreHex,
        hindHex,
        releasedAt,
        seed,
      },
    };
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
}

/**
 * Misafirin bugün hakkını kullanıp kullanmadığı.
 *
 * Kart açılırken gerekiyor: buton *One a day* olup kilitleniyor. Çerez
 * `httpOnly` olduğu için istemci kendisi bakamıyor — sunucu söylüyor.
 */
export async function guestReleaseUsed(): Promise<boolean> {
  return (await guestReleasesToday()) >= GUEST_DAILY_LIMIT;
}
