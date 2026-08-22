-- ═══════════════════════════════════════════════════════════════════════════
-- Butterfly Garden — profil kilidi (Aşama F)
--
--   npm run migrate
--
-- Ayarlar ekranı "once saved, name and colour cannot be changed again for
-- 1 day" diye söz veriyor. Söz bugüne kadar yalnızca istemcide duruyordu ve
-- yenilemek onu sıfırlıyordu; bu sütun onu tutan yer.
-- ═══════════════════════════════════════════════════════════════════════════

-- ⚠ Kilidin KAÇ GÜN olduğu burada YAZILI DEĞİL. Süre `lib/types.ts`
-- (`PROFILE_LOCK_DAYS`) ve anı uygulama hesaplıyor; şemaya bir varsayılan ya
-- da bir CHECK yazmak, kural değiştiğinde veritabanının sessizce eski süreyle
-- çalışması demek olurdu (`expires_at` ile aynı karar, 0001).
--
-- NULL = hiç kaydedilmemiş ya da kilit dolmuş. Geçmiş bir an da kilitsiz
-- demek: satır temizlenmiyor, süresi geçiyor.
alter table garden.account
  add column if not exists profile_locked_until timestamptz;

comment on column garden.account.profile_locked_until is
  'İsim/renk kilidinin bittiği an. NULL ya da geçmiş bir an = kilitsiz.';

-- ⚠ Hesap KURULUMU (`completeSetup`) bu sütunu DOLDURMUYOR: ilk isim bir
-- düzenleme değil, hesabın açılışı. Kilidi orada başlatmak, yeni üyeyi bir gün
-- boyunca yanlış yazılmış bir isme mahkûm ederdi.
