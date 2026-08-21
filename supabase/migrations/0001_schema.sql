-- ═══════════════════════════════════════════════════════════════════════════
-- Butterfly Garden — şema (Aşama E.1)
--
-- Supabase SQL editöründe olduğu gibi çalıştırılabilir; `supabase db push` de
-- aynı dosyayı okur. Kimlik Supabase Auth'ta (`auth.users`), buradaki tablolar
-- onun üstüne biniyor.
--
-- ⚠ Kurallar burada DEĞİL. Ömrün kaç gün olduğu (`LIFESPAN_DAYS`), kontenjan
-- sayıları ve isim uzunluğu `lib/types.ts` ile `src/world/config.js`te duruyor;
-- buraya ikinci bir kopyasını yazmak, kural değiştiğinde veritabanının sessizce
-- eski kuralla çalışması demek. Aşağıdaki CHECK'ler kuralın kendisi değil,
-- uygulamanın saçmalamadığını doğrulayan SINIRLAR.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── profiles ───────────────────────────────────────────────────────────────
--
-- Kayıt İKİ adım: önce e-posta + şifre alınıyor (`auth.users`), sonra hesap
-- kurulumu ekranında isim ve renk seçiliyor. Bu yüzden satır kayıt anında
-- trigger'la açılıyor ama `name` ve `avatar_hex` NULL başlıyor; kurulum
-- tamamlanana kadar profil EKSİK sayılıyor (`name is null`).

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text,
  avatar_hex  text,
  created_at  timestamptz not null default now(),

  -- `NAME_MAX` = 18 (lib/types.ts). Buradaki 18 o kuralın kopyası değil, üst
  -- sınırı: arayüz zaten kesiyor, bu satır kesilmemiş bir şey gelirse yazmayı
  -- reddediyor.
  constraint profiles_name_length
    check (name is null or char_length(name) between 1 and 18),
  constraint profiles_avatar_hex
    check (avatar_hex is null or avatar_hex ~ '^#[0-9A-F]{6}$')
);

comment on column public.profiles.name is
  'Hesap kurulumu tamamlanana kadar NULL. NULL = profil eksik.';


-- Kayıt olan herkese boş bir profil satırı.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── butterflies ────────────────────────────────────────────────────────────
--
-- İki nüfus tek tabloda: `owner_id is null` MİSAFİR kelebeği demek. Ayrı tablo
-- açılsaydı çayır sorgusu ikisini birleştirmek zorunda kalırdı ve kontenjan
-- sayımı ikiye bölünürdü.

create table if not exists public.butterflies (
  id           uuid primary key default gen_random_uuid(),

  -- NULL = misafir kelebeği: sahibi yok, ismi yok, iki kanadı aynı renk.
  owner_id     uuid references public.profiles (id) on delete cascade,

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

  constraint butterflies_lifespan
    check (expires_at > released_at),
  constraint butterflies_name_length
    check (name is null or char_length(name) between 1 and 18),
  constraint butterflies_fore_hex
    check (fore_hex is null or fore_hex ~ '^#[0-9A-F]{6}$'),
  constraint butterflies_hind_hex
    check (hind_hex is null or hind_hex ~ '^#[0-9A-F]{6}$'),

  -- Misafir kelebeğinin ismi olmaz ve iki kanadı aynı renktir. İki renkli kanat
  -- üyeye özel (projefikri.md §2); bu iki satır o ayrımı veritabanında tutuyor.
  constraint butterflies_guest_is_anonymous
    check (owner_id is not null or name is null),
  constraint butterflies_guest_is_one_colour
    check (owner_id is not null or fore_hex is not distinct from hind_hex)
);

-- Çayır sorgusu ve kontenjan sayımı hep "şu an uçanlar" diye soruyor.
create index if not exists butterflies_live_idx
  on public.butterflies (expires_at)
  where fore_hex is not null;

-- Üyenin kendi listesi ve beş yuvalık tavanın sayımı.
create index if not exists butterflies_owner_idx
  on public.butterflies (owner_id, expires_at);


-- ── counters ───────────────────────────────────────────────────────────────
--
-- Küresel salma sayacı. Kelebek sayısından TÜRETİLMİYOR: ömrü dolan kelebek
-- çayırdan kalkıyor ama sayılmış olmaktan çıkmıyor, ve misafir kontenjanı
-- dolduğunda çayıra hiç girmeyen kelebek de sayılıyor (bkz. CLAUDE.md — yem
-- kelebek).

create table if not exists public.counters (
  key    text primary key,
  value  bigint not null default 0
);

-- Tohum 27. Sahte ve bilinçli: bomboş bir sayaç çayırı "kimsenin uğramadığı bir
-- yer" gibi gösteriyor. Üstüne eklenen her +1 gerçek.
--
-- ⚠ Bu satır sayacın tek kopyası. `app/page.tsx`teki 27 bunun için kaldırıldı;
-- istemcide kaldığı sürece her sekme kendi 27'sinden başlıyordu ve sayaç
-- küresel bir toplam olmaktan çıkıyordu.
insert into public.counters (key, value) values ('released_total', 27)
  on conflict (key) do nothing;


-- ── Satır bazlı güvenlik ───────────────────────────────────────────────────
--
-- Tarayıcı Supabase ile HİÇ konuşmuyor: bütün okuma ve yazma Server Action
-- içinden geçiyor, anon anahtar bile istemciye inmiyor. Yine de RLS açık ve
-- politikalar dar — anahtarlardan biri sızarsa tek başına bir işe yaramasın.

alter table public.profiles    enable row level security;
alter table public.butterflies enable row level security;
alter table public.counters    enable row level security;

-- Profil: yalnızca kendi satırın, yalnızca okuma ve güncelleme. Satırı trigger
-- açıyor, silmeyi `on delete cascade` yapıyor; ikisi de politikaya girmiyor.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Kelebek: yalnızca KENDİ kelebeklerin. Çayırın tamamı buradan değil, aşağıdaki
-- `meadow` görünümünden okunuyor — orada sahip bilgisi hiç yok.
drop policy if exists butterflies_select_own on public.butterflies;
create policy butterflies_select_own on public.butterflies
  for select using (auth.uid() = owner_id);

-- ⚠ Yazma politikası YOK ve olmayacak. Salma kontenjan sayımı ister ve o sayım
-- iki sekme arasında yarışa girmemek için tek işlemde olmak zorunda;
-- politikayla ifade edilemez. Salma servis anahtarıyla, Server Action içinden
-- (Aşama E.2).

-- Sayaç: politika yok, yani anon ve authenticated için erişim yok. Servis
-- anahtarı RLS'i zaten atlıyor.


-- ── meadow görünümü ────────────────────────────────────────────────────────
--
-- Çayır HERKESE açık: misafir de üye de aynı kelebekleri görüyor. Ama kimin
-- kelebeği olduğu kimseyi ilgilendirmiyor — bu görünüm `owner_id` TAŞIMIYOR,
-- yani sızdıracak bir şeyi yok.
--
-- `security_invoker` bilinçli olarak kapalı (varsayılan): görünüm sahibinin
-- yetkisiyle çalışıyor ve altındaki RLS'i atlıyor. Atladığı şey zaten "yalnızca
-- kendi kelebeklerin" politikası; buradaki sütunlarda kişisel bir şey yok.

create or replace view public.meadow as
  select
    b.id,
    b.seed,
    b.fore_hex,
    b.hind_hex,
    b.released_at,
    b.expires_at,
    (b.owner_id is null) as is_guest
  from public.butterflies b
  where b.fore_hex is not null      -- rengi alınmış = ömrü dolmuş
    and b.expires_at > now();

comment on view public.meadow is
  'Çayırın herkese açık görünümü. owner_id TAŞIMAZ — sütun eklerken bunu düşün.';
