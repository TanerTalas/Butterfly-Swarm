-- ═══════════════════════════════════════════════════════════════════════════
-- Butterfly Garden — Google ile giriş (Aşama G)
--
--   npm run migrate
--
-- Giriş kartındaki buton bugüne kadar `disabled` duruyordu. Hesap satırının
-- iki yeni şeye ihtiyacı var: şifresiz doğabilmek ve Google tarafındaki
-- kimliği taşıyabilmek.
-- ═══════════════════════════════════════════════════════════════════════════

-- ⚠ Google'la açılan hesabın ŞİFRESİ YOK ve olmayacak. Sütun bugüne kadar
-- `not null`dı; kalsaydı ya sahte bir özet yazmak (giriş denenebilir bir kapı)
-- ya da ayrı bir tablo açmak gerekirdi.
--
-- `lib/server/password.ts` bu durumu ZATEN doğru işliyor: `verifyPassword`
-- NULL özet gördüğünde `DUMMY_HASH` ile aynı işi yapıp `false` dönüyor, yani
-- şifresiz bir hesaba şifreyle girmeye çalışmak ne farklı bir cevap ne farklı
-- bir SÜRE üretiyor. Tek mesaj kuralı burada da geçerli.
alter table garden.account
  alter column password_hash drop not null;

-- ⚠ ANAHTAR `google_sub`, E-POSTA DEĞİL.
--
-- Google hesabının adresi değişebiliyor (kurumsal hesaplarda sıradan bir şey);
-- `sub` ise sabit ve hiçbir zaman başka bir kullanıcıya yeniden verilmiyor.
-- E-posta yalnızca İLK eşlemede, var olan bir hesabı bulmak için kullanılıyor.
alter table garden.account
  add column if not exists google_sub text;

comment on column garden.account.google_sub is
  'Google tarafındaki sabit kullanıcı kimliği (OIDC `sub`). NULL = bağlı değil.';

-- Kısmi indeks: `google_sub` NULL olan satırlar birbirini engellemiyor, ama
-- bir Google hesabı yalnızca tek bir çayır hesabına bağlanabiliyor.
create unique index if not exists account_google_sub_key
  on garden.account (google_sub) where google_sub is not null;

-- ⚠ Her hesabın İÇERİ GİREN BİR YOLU olmak zorunda. İkisi de NULL olan bir
-- satır, sahibinin bir daha ulaşamayacağı bir hesap demek: ne şifresi var, ne
-- bağlı bir Google kimliği. Bu kısıt olmadan böyle bir satır sessizce
-- yazılabilirdi.
do $$
begin
  alter table garden.account
    add constraint account_has_a_way_in
    check (password_hash is not null or google_sub is not null);
exception
  when duplicate_object then null;
end $$;
