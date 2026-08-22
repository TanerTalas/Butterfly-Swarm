-- ═══════════════════════════════════════════════════════════════════════════
-- Butterfly Garden — şema (Aşama E.1)
--
--   psql "$DATABASE_URL" -f db/migrations/0001_schema.sql
--
-- Düz Postgres. Belirli bir sağlayıcıya ait hiçbir şey yok — Neon, Supabase'in
-- Postgres'i, yerel bir kurulum, hepsinde aynı çalışır. Barındırma kararının
-- yayın gününe ertelenebilmesinin sebebi bu.
--
-- Her şey `garden` şemasında. Ayrı şema bilinçli: paylaşılan bir veritabanına
-- düşmek gerekirse migration yeniden yazılmıyor, yalnızca bağlantının
-- `search_path`i değişiyor (`lib/server/db.ts`).
--
-- ⚠ Kurallar burada DEĞİL. Ömrün kaç gün olduğu (`LIFESPAN_DAYS`), kontenjanlar
-- ve isim uzunluğu `lib/types.ts` ile `src/world/config.js`te duruyor; buraya
-- ikinci bir kopyasını yazmak, kural değiştiğinde veritabanının sessizce eski
-- kuralla çalışması demek. Aşağıdaki CHECK'ler kuralın kendisi değil,
-- uygulamanın saçmalamadığını doğrulayan SINIRLAR.
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists garden;

-- `gen_random_uuid()` Postgres 13'ten beri çekirdekte; eski sürümler için.
create extension if not exists pgcrypto;


-- ── account ────────────────────────────────────────────────────────────────
--
-- Kayıt İKİ adım: önce e-posta + şifre, sonra hesap kurulumu ekranında isim ve
-- renk. Bu yüzden `name` ve `avatar_hex` NULL başlıyor; kurulum tamamlanana
-- kadar hesap EKSİK sayılıyor (`name is null`).

create table if not exists garden.account (
  id                 uuid primary key default gen_random_uuid(),

  email              text not null,

  -- ⚠ argon2id özeti. Düz şifre hiçbir zaman, hiçbir yerde saklanmıyor —
  -- loglara da girmiyor (bkz. lib/server/password.ts).
  password_hash      text not null,

  -- NULL = e-posta henüz doğrulanmadı. Doğrulanmamış hesap kelebek salamıyor.
  email_verified_at  timestamptz,

  name               text,
  avatar_hex         text,
  created_at         timestamptz not null default now(),

  -- `NAME_MAX` = 18 (lib/types.ts). Arayüz zaten kesiyor; bu satır kesilmemiş
  -- bir şey gelirse yazmayı reddediyor.
  constraint account_name_length
    check (name is null or char_length(name) between 1 and 18),
  constraint account_avatar_hex
    check (avatar_hex is null or avatar_hex ~ '^#[0-9A-F]{6}$')
);

comment on column garden.account.name is
  'Hesap kurulumu tamamlanana kadar NULL. NULL = hesap eksik.';

-- ⚠ Benzersizlik `lower(email)` üstünde: "Ali@x.com" ile "ali@x.com" AYNI hesap.
-- `citext` kullanılmadı, çünkü her Postgres kurulumunda bulunmuyor ve bu şemanın
-- taşınabilir kalması gerekiyor.
create unique index if not exists account_email_key
  on garden.account (lower(email));


-- ── session ────────────────────────────────────────────────────────────────
--
-- Oturum, imzalı bir JWT değil OPAK bir token. Sebebi iptal edilebilirlik:
-- hesap silindiğinde ya da "bütün oturumları kapat" dendiğinde JWT'yi geri
-- almanın yolu yok, satırı silmenin var.
--
-- ⚠ Token'ın KENDİSİ saklanmıyor, SHA-256 ÖZETİ saklanıyor. Veritabanı sızarsa
-- elindeki şey canlı oturumlar değil, işe yaramaz özetler olsun.

create table if not exists garden.session (
  token_hash  bytea primary key,
  account_id  uuid not null references garden.account (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,

  constraint session_lifespan check (expires_at > created_at)
);

create index if not exists session_account_idx
  on garden.session (account_id);

-- Süresi geçmiş oturumların temizliği (Aşama F'deki günlük iş).
create index if not exists session_expires_idx
  on garden.session (expires_at);


-- ── email_token ────────────────────────────────────────────────────────────
--
-- E-posta doğrulama ve şifre sıfırlama bağlantıları. Oturum token'ıyla aynı
-- kural: özet saklanıyor, ham token yalnızca postadaki bağlantıda.
--
-- ⚠ ÖMRÜ BİR SAAT ve bu keyfi değil: `SignInCard` → `VerifyCard` ekranda
-- "the link lasts an hour" diye söz veriyor. Süre değişecekse o cümle de
-- değişmeli.

create table if not exists garden.email_token (
  token_hash  bytea primary key,
  account_id  uuid not null references garden.account (id) on delete cascade,
  purpose     text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,

  -- Tek kullanımlık: doğrulanan bağlantı ikinci kez çalışmıyor.
  used_at     timestamptz,

  constraint email_token_purpose check (purpose in ('verify', 'reset')),
  constraint email_token_lifespan check (expires_at > created_at)
);

create index if not exists email_token_account_idx
  on garden.email_token (account_id, purpose);


-- ── sign_in_attempt ────────────────────────────────────────────────────────
--
-- Giriş denemesi kısıtı. `SignInCard` bu hâli zaten çiziyor: buton
-- "Too many attempts" olup kilitleniyor.
--
-- ⚠ Anahtar KAYITLI OLMAYAN e-postalar için de tutuluyor. Yalnızca var olan
-- hesaplar kısıtlansaydı, kısıtın devreye girip girmemesi "bu e-posta kayıtlı
-- mı" sorusunu yanıtlardı — girişteki tek mesaj kuralını arka kapıdan delerdi.
--
-- ⚠ Bilinen bir zayıflık: anahtar e-posta olduğu için, birinin adresini bilen
-- biri o hesabı kasten kilitleyebilir. IP başına kısıt (asıl çözüm) kötüye
-- kullanım işinin geri kalanıyla birlikte E.2'de geliyor; buradaki kilit kısa
-- ömürlü olduğu için zarar da kısa ömürlü.

create table if not exists garden.sign_in_attempt (
  email_key     text primary key,
  failures      int not null default 0,
  first_at      timestamptz not null default now(),
  locked_until  timestamptz
);


-- ── butterfly ──────────────────────────────────────────────────────────────
--
-- İki nüfus tek tabloda: `owner_id is null` MİSAFİR kelebeği demek. Ayrı tablo
-- açılsaydı çayır sorgusu ikisini birleştirmek zorunda kalırdı ve kontenjan
-- sayımı ikiye bölünürdü.

create table if not exists garden.butterfly (
  id           uuid primary key default gen_random_uuid(),

  -- NULL = misafir kelebeği: sahibi yok, ismi yok, iki kanadı aynı renk.
  owner_id     uuid references garden.account (id) on delete cascade,

  name         text,

  -- ⚠ Ömrü dolan kelebeğin RENGİ siliniyor, satırı değil (gizlilik metninin
  -- sözü: "renk ve çayırdaki yer gidiyor, isim ve tarih geçmişte kalıyor").
  -- Bu yüzden nullable — canlı kelebekte dolu, geçmişte boş.
  fore_hex     text,
  hind_hex     text,

  -- Sahnenin görünüş çekilişlerini yaptığı tohum. İstemci bugün onu kimlikten
  -- türetiyor (`visitors.js` → `hashSeed`); buradan gelmeye başladığında
  -- yalnızca değer değişecek, mekanizma aynı kalacak.
  seed         bigint not null,

  released_at  timestamptz not null default now(),

  -- ⚠ MUTLAK an olarak saklanıyor, "kaç gün" olarak değil. Değeri uygulama
  -- hesaplıyor (`lib/types.ts` → `expiresAt`); veritabanı yalnızca sıralamayı
  -- doğruluyor. Generated column yapılsaydı yedi gün kuralının ikinci bir
  -- kopyası burada olurdu.
  expires_at   timestamptz not null,

  constraint butterfly_lifespan
    check (expires_at > released_at),
  constraint butterfly_name_length
    check (name is null or char_length(name) between 1 and 18),
  constraint butterfly_fore_hex
    check (fore_hex is null or fore_hex ~ '^#[0-9A-F]{6}$'),
  constraint butterfly_hind_hex
    check (hind_hex is null or hind_hex ~ '^#[0-9A-F]{6}$'),

  -- Misafir kelebeğinin ismi olmaz ve iki kanadı aynı renktir. İki renkli kanat
  -- üyeye özel (projefikri.md §2); bu iki satır o ayrımı veritabanında tutuyor.
  constraint butterfly_guest_is_anonymous
    check (owner_id is not null or name is null),
  constraint butterfly_guest_is_one_colour
    check (owner_id is not null or fore_hex is not distinct from hind_hex)
);

-- Çayır sorgusu ve kontenjan sayımı hep "şu an uçanlar" diye soruyor.
create index if not exists butterfly_live_idx
  on garden.butterfly (expires_at)
  where fore_hex is not null;

-- Üyenin kendi listesi ve beş yuvalık tavanın sayımı.
create index if not exists butterfly_owner_idx
  on garden.butterfly (owner_id, expires_at);


-- ── counters ───────────────────────────────────────────────────────────────
--
-- Küresel salma sayacı. Kelebek sayısından TÜRETİLMİYOR: ömrü dolan kelebek
-- çayırdan kalkıyor ama sayılmış olmaktan çıkmıyor, ve misafir kontenjanı
-- dolduğunda çayıra hiç girmeyen kelebek de sayılıyor (bkz. CLAUDE.md — yem
-- kelebek).

create table if not exists garden.counters (
  key    text primary key,
  value  bigint not null default 0
);

-- Tohum 27. Sahte ve bilinçli: bomboş bir sayaç çayırı "kimsenin uğramadığı bir
-- yer" gibi gösteriyor. Üstüne eklenen her +1 gerçek.
--
-- ⚠ Bu satır sayacın tek kopyası. `app/page.tsx`teki 27 bunun için kaldırıldı;
-- istemcide kaldığı sürece her sekme kendi 27'sinden başlıyordu ve sayaç
-- küresel bir toplam olmaktan çıkıyordu.
insert into garden.counters (key, value) values ('released_total', 27)
  on conflict (key) do nothing;
