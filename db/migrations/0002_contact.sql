-- ═══════════════════════════════════════════════════════════════════════════
-- Butterfly Garden — iletişim mesajları (Aşama E.4)
--
--   npm run migrate
--
-- İletişim formu SİTEDEKİ İKİNCİ KİMLİKSİZ YAZMA NOKTASI (ilki misafir salma).
-- Salmadan farkı, yazılan şeyin serbest metin olması: kontenjan tavanı gibi
-- kendiliğinden duran bir sınırı yok, sınırı buradaki satırlar veriyor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── contact_message ────────────────────────────────────────────────────────
--
-- Mesaj hem POSTAYLA gidiyor hem burada duruyor. İkisi birden, çünkü posta
-- sağlayıcısı bir gün cevap vermeyebilir ve o sırada gelen mesajın kaybolması
-- "usually within a few days" sözünü tutulamaz hâle getirir (lib/legal.ts →
-- Contact). Satır, postanın yedeği.
--
-- ⚠ Gizlilik metni bu tabloyu ANLATMAK ZORUNDA. `lib/legal.ts`teki her cümle
-- bir davranış taahhüdü ve saklanan yeni bir şey oraya yazılmadan eklenemez.

create table if not exists garden.contact_message (
  id          uuid primary key default gen_random_uuid(),

  -- ⚠ Oturum varsa hesap ÇEREZDEN okunuyor, formdan değil. Formdaki e-posta
  -- kanıtlanmamış bir iddia; bu sütun kanıtlanmış olan. "Verimi silin" diyen
  -- bir mesajın hangi hesaba ait olduğu ancak buradan bilinebilir.
  --
  -- `on delete set null`: hesabını silen birinin mesajı duruyor ama artık
  -- kimseye bağlı değil. `cascade` olsaydı silme, cevaplanmamış bir soruyu da
  -- götürürdü; kalan satır ise kimliksiz.
  account_id  uuid references garden.account (id) on delete set null,

  -- Formda yazılanlar. `email` DOĞRULANMAMIŞ: kimse bu adresin sahibi
  -- olduğunu kanıtlamadı, o yüzden cevap yazarken tek başına dayanak değil.
  name        text not null,
  email       text not null,
  body        text not null,

  -- ⚠ IP'nin KENDİSİ değil SHA-256 özeti. Kısıt için gereken tek şey "aynı
  -- yerden mi geldi" sorusunun cevabı; adresin kendisini saklamak, sormadığımız
  -- bir soruyu yanıtlayan bir veri tutmak olurdu.
  ip_hash     bytea,

  created_at  timestamptz not null default now(),

  -- Uzunluklar `lib/types.ts`te (`CONTACT_NAME_MAX`, `CONTACT_BODY_MAX`).
  -- Aşağısı kuralın kopyası değil, kesilmemiş bir şey gelirse yazmayı
  -- reddeden SINIR — şemadaki bütün CHECK'ler gibi.
  constraint contact_message_name_length
    check (char_length(name) between 1 and 80),
  constraint contact_message_email_length
    check (char_length(email) between 3 and 254),
  constraint contact_message_body_length
    check (char_length(body) between 1 and 4000)
);

-- Kısıt sorgusunun tek sorusu: "bu özetten son bir saatte kaç mesaj geldi".
create index if not exists contact_message_ip_idx
  on garden.contact_message (ip_hash, created_at);

-- Okuma sırası: en yeni mesaj en üstte.
create index if not exists contact_message_recent_idx
  on garden.contact_message (created_at desc);
