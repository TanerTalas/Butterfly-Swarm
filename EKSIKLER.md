# Eksikler ve açık işler

**Bu dosyada YALNIZCA yapılmamış işler var.** Biten bir iş buradan siliniyor;
ondan geriye kalması gereken bir kural varsa `CLAUDE.md`'ye taşınıyor.

Son güncelleme: 22 Ağustos 2026.

Aşamalı sıra `ROADMAP.md` → Bölüm II'de. Aşağısı o sıranın açık kalemleri.

---

## Durum özeti

**Tasarım işi kalmadı.** Bütün ekranlar, durum hâlleri, mobil yerleşim, odak
yönetimi ve metinler tamam. Sahne canlı: kelebek salınıyor, izleniyor,
soluyor.

**Kimlik gerçek.** Hesap açılıyor, e-posta doğrulanıyor, giriş yapılıyor ve
oturum yenilemeden sağ çıkıyor (E.1 bitti).

**Salma ve kalıcılık gerçek.** Kelebek veritabanına yazılıyor, kontenjanlar
sunucuda uygulanıyor, dört red de dönüyor, sayaç artıyor (E.2). Çayır, kişisel
liste ve geçmiş sunucudan geliyor: `F5` hiçbir şeyi kaybetmiyor ve çayır ortak
bir yer (E.3).

⚠ **HESAP SİLME SAHTE** ve önce bir arayüz eksiği kapanmalı (§1.3). Ömrü dolanın
rengini silen zamanlanmış iş de yok, yani geçmiş kendiliğinden dolmuyor.

| | |
|---|---|
| Ekranlar | Karşılama, misafir salma, onay, giriş/kayıt, hesap kurulumu, çayır, kanat seçimi, kelebeklerim, geçmiş, hesabım, ayarlar, veda, 4 yasal sayfa |
| Sahne | Canlı three.js sakura çayırı: 60 yerleşik + 20 misafir + 120 üye yuvası |
| Mobil | 390px'te denendi |
| Veritabanı | Postgres (Neon, Frankfurt). Şema `garden`; `npm run migrate` |
| Build | `npm run build` geçiyor (8/8 sayfa), `tsc --noEmit` temiz |

---

## 1. Sunucu

**E.1 (şema + kimlik) BİTTİ.** Gerçek hesapla girilip çıkılabiliyor, yenilemede
oturum duruyor, şifre argon2id özeti olarak saklanıyor, kayıt e-posta
doğrulamasından geçiyor. Kurallar `CLAUDE.md` → "Kimlik"te.

Kalanlar aşağıda.

### 1.1 Kimlik

- **Google ile giriş.** Buton çizili ama bağlı değil ve bu yüzden DEVRE DIŞI
  duruyor. Kendi auth'umuzu yazdığımız için OAuth akışını da yazmak gerekiyor
  (~150 satır, kütüphane gerekmez).
- **Cloudflare Turnstile** girişte ve kayıtta. Bot koruması bizim yazacağımız
  bir şey değil.
- **Deneme kısıtı IP başına da olmalı.** Bugün yalnızca e-posta anahtarıyla
  (`garden.sign_in_attempt`) ve bu, adresini bilen birinin bir hesabı kasten
  kilitlemesine açık. Kilit kısa ömürlü olduğu için zarar da kısa ömürlü, ama
  asıl çözüm IP.
- **Yetki kontrolü her uç noktada.** Kelebek silme/düzenleme sahibine bağlı
  olmalı; `id` tahmin edilebilir olmamalı. (Bugünkü uç noktalarda hesap kimliği
  hep çerezden okunuyor, çağrıdan değil — kural bu, yeni uç noktalarda da
  korunmalı.)
- CSRF, güvenlik başlıkları ve tam CSP (bkz. §5).
- **Şifre gücü yalnızca uzunluğa bakıyor** (`PASSWORD_MIN` = 10). Handoff sızmış
  şifre listesine bakılmasını da istiyor.
- **Kısa şifrenin sunucu reddi `credentials` diline düşüyor** ve bu tam oturan
  bir eşleşme değil — "şifren kurallara uymuyor" diye çizilmiş bir hâl yok.
  Arayüzden ulaşılamayan bir yol olduğu için bugün sorun değil.

### 1.2 Salma ve tavanlar

**E.2 BİTTİ.** Salma sunucuda (`app/actions/release.ts`): kontenjanlar, günlük
hak, renk çekilişi, tohum ve sayaç. Dört red de gerçekten dönüyor. Kurallar
`CLAUDE.md` → "Salma"da.

- **Kalan gün hâlâ istemcide hesaplanıyor** (`daysLeft()`). Bugün yalnızca
  ilerleme çubuğunu çizdiği için zararsız; ömrü dolanı listeden düşürecek olan
  §1.4 bunu sunucuya taşımalı.
- **IP başına kısıt yok.** Günlük hak yalnızca çerezde ve çerez silinebilir —
  kabul edilmiş bir şey (asıl koruma kontenjan tavanı), ama salma tek
  kimliksiz yazma noktası ve handoff IP başına da sınır istiyor.
- **İsim moderasyonu yok.** Kelebek isimleri başkalarına görünen kullanıcı
  içeriği; handoff Unicode normalizasyonu, sıfır genişlikli karakterlerin
  ayıklanması, küfür/hakaret listesi ve kaldırılabilir bir moderasyon kuyruğu
  istiyor. Bugün yalnızca uzunluk kontrol ediliyor.

### 1.3 Liste ve kalıcılık

**Büyük kısmı BİTTİ.** Çayır, "Kelebeklerim" ve geçmiş sunucudan geliyor
(`lib/server/meadow.ts`); `F5` çayırı bozmuyor, başkasının kelebeği görünüyor,
çıkış yapan birinin kelebeği uçmaya devam ediyor.

- ⚠ **HESAP SİLME HÂLÂ SAHTE.** `Garden.deleteAccount()` yalnızca ekranı
  temizliyor; hiçbir şey silinmiyor ve yenileyince hesap geri geliyor.
  Ayrıntısı §1.5'te.
- **Rengi silen iş yazılmadı.** `fore_hex`/`hind_hex` nullable ve "renk yoksa
  ömrü dolmuş" kuralı hem şemada hem sorgularda kurulu, ama ömrü dolanın
  rengini boşaltan zamanlanmış iş yok. Onsuz geçmiş ekranı KENDİLİĞİNDEN
  dolmaz (bugün yalnızca elle eklenmiş satırlarla dolduruluyor) ve gizlilik
  metninin sözü tutulmaz.
- **Listeler yalnızca giriş anında ve sayfa açılışında çekiliyor.** Başka bir
  sekmede salınan kelebek bu sekmenin çayırında görünmüyor. Bugün sorun değil
  (çayır sessiz bir yer), ama "canlı" hissi isteniyorsa periyodik bir
  yenileme gerekir.

### 1.4 Ömrün gerçekten işlemesi

Hepsi "ömür doldu" diyecek bir otoriteye dayanıyor, o yüzden sunucudan önce
yapılamaz.

- **Ömrü dolan kelebeği listeden düşür.** Sahnedeki solma zaten çalışıyor ve
  kelebek görünmez oluyor; ama sahne onu KALDIRMIYOR, çünkü listeden düşürme
  kararı listenin sahibinin. Eksik olan tetikleyici.
- **Boşalan yuva havuza dönüyor.** Mekanizma hazır (`visitors.remove`).
- **Veda ekranı** (`farewell`) gerçek bir olaya bağlanacak; bugün hiç
  tetiklenmiyor.
- **Ayarlardaki 1 günlük renk kilidi** sunucuda uygulanacak; `lockedUntil`
  prop'u duruyor ama kimse doldurmuyor ve istemcideki tarih yenilemede
  sıfırlanıyor.

### 1.5 Hesap silme

`SettingsCard` onay adımı gösteriyor ve kullanıcı hesap ismini yazmadan
`Delete for good` açılmıyor. `deleteAccount()` şu an yalnızca ekranı
temizliyor — hiçbir şey silinmiyor.

**KARAR: şifre sorulmayacak.** İsim yazma eşiği tek eşik olarak kalıyor; onay
adımına şifre alanı eklenmeyecek.

⚠ Bedeli açıkça: **çalınmış ya da açık bırakılmış bir oturumla hesap kalıcı
olarak silinebiliyor** ve geri alınamıyor. Bu bilinen ve kabul edilmiş bir
risk, gözden kaçmış bir eksik değil.

Sunucu tarafında kalanlar:

- Hesabın ve ona bağlı verinin gerçekten silinmesi. **Kalıcı, geri alma
  penceresi yok.** (`on delete cascade` kelebekleri, oturumları ve token'ları
  zaten götürüyor — denendi.)
- Kelebeklerin çayırdan **anında** kalkması — uyarı metninin verdiği söz bu.
- Bütün oturumların sonlandırılması. Mekanizma hazır ve şifre sıfırlamada
  çalıştığı görüldü: `destroyAllSessions()` (`lib/server/session.ts`).

### 1.6 İletişim formu

`components/legal/ContactForm.tsx` hiçbir yere göndermiyor — gönderim
yalnızca `setSent(true)` yapıyor.

- Gerçek bir uç nokta + e-posta gönderimi.
- **Cloudflare Turnstile.** Bal küpü alanı duruyor ama tek başına yetmiyor;
  form kimliksiz bir yazma noktası.
- Gönderenin adresi doğrulanmıyor: yanıt yazılacaksa ilişkilendirme sunucuda
  yapılmalı.

---

## 2. Sunucu gelince kaldırılacaklar

- **`window.__garden` geliştirme kancası.** Üretimde derlenmiyor ama gerçek
  red cevapları gelince gereksizleşiyor (bkz. Notlar). D1 ve D6 zaten gerçek
  olabiliyor; kalan dördü salmaya bağlı.

---

## 3. Kalan ufak işler

- Sahnenin düşük kalite profiline geçmesi (`pickQuality` 900px'e bakıyor).
- Kanat renk örnekleri hâlâ 28px; dokunma hedefi 44px'e çıkarılabilir.
- **Köprüde `recolor` yok.** Fark hesabı `id` üzerinden bakıyor; var olan bir
  kelebeğin rengi değişirse sahneye yansımaz. Bugün renk salındıktan sonra
  değişmediği için sorun değil — ayarlardaki kilit gerçek bir renk
  düzenlemesine dönüşürse gerekecek.

---

## 4. Karar bekleyenler

**Renk seçicide doygunluk alt sınırı.** Soluk bir renk seçen kullanıcı
kelebeğini çayırda kaybediyor. Serbest hex girişi duruyor, sınır konmadı.

**Sayaç tohumu ile gizlilik metni.** Metin sayıyı "the count of how many
butterflies have been released" diye tarif ediyor; 27'lik sahte tohumla
birlikte bu tam doğru değil. Metin yumuşatılmalı ya da tohum kaldırılmalı —
hukuki incelemede (§5) sorulacak yerlerden biri.

**Üye kontenjanının büyümesi.** 120 yuva ≈ aynı anda en fazla 24 üyenin beş
kelebeği. `meadow-full` bir güvenlik supabı, çözüm değil; ürün büyürse ilk
sıkışacak yer burası.

---

## 5. Yayına çıkmadan önce zorunlu

- **Depo private yapılmalı.** Şu an herkese açık. Handoff bunu şart koşuyor;
  `design_handoff_butterfly_garden/` bu yüzden commit'lenmedi.
- **Yasal metinler gerçek değil.** Sade dille ve ürünün gerçek davranışına
  göre yazıldı ama hukuki inceleme görmedi; KVKK/GDPR sürümleriyle
  değişmeli. Veri olarak duruyorlar (`lib/legal.ts`), JSX değil.
- **Inkwell atıfı.** MIT lisansı telif bildiriminin korunmasını şart koşuyor;
  `public/textures/CREDITS.txt` var ama sitenin atıf sayfasına da girmeli.
- **Model dosyaları ~6 MB ham PNG doku.** KTX2'ye çevrilip küçültülmeli.
- **CSP başlıkları.** `next.config.mjs`'te temel başlıklar var; three.js için
  `worker-src blob:` gereken tam CSP yazılmadı.
- ⚠ **Vercel fonksiyon bölgesi `fra1` yapılmalı.** Varsayılan `iad1`
  (Washington) ve veritabanı Frankfurt'ta; düzeltilmezse HER sorgu Atlantik'i
  geçer. Bir sayfa açılışı birkaç sorgu yapıyor, yani bu tek ayar yüzlerce ms
  demek. Bölgeyi Neon tarafında düzeltmek mümkün DEĞİL — orada sonradan
  değiştirilemiyor.
- **Üretim ortam değişkenleri:** `DATABASE_URL` (üretim veritabanı, pooled),
  `APP_URL` (alan adı), `RESEND_API_KEY` + `MAIL_FROM`. Son ikisi boş kalırsa
  kaydolan herkes hiç açılmayacak bir kapının önünde kalır.

---

## Notlar

**Geliştirme sunucusu:** `npm run dev` → http://localhost:3000
(port doluysa Next kendisi bir sonrakine geçiyor, çıktıya bak)
**Laboratuvarlar:** `npm run lab` (Vite) — `index.html`, `lab.html`,
`world.html`

⚠️ Build alacaksan önce dev sunucusunu durdur. İkisi aynı `.next` klasörüne
yazıyor; birlikte çalıştıklarında CSS tamamen kaybolabiliyor.

⚠️ `.env.local` değişince dev sunucusunu YENİDEN BAŞLAT. Next ortam
değişkenlerini açılışta okuyor; ayrıca veritabanı havuzu `globalThis`te
saklandığı için (`lib/server/db.ts`) hot reload onu tazelemiyor.

### Veritabanıyla çalışmak

**Şema:** `npm run migrate` — `psql` gerekmiyor. Yeniden çalıştırmak zararsız;
uygulananlar `garden.migration` defterinde.

**Postalar konsola basılıyor** (doğrulama ve şifre sıfırlama bağlantıları dev
sunucusunun çıktısında). Resend anahtarı gerekmiyor.

**Doğrulanmış bir test hesabı** açmanın en kısa yolu — arayüzden kayıt olup
posta beklemeye gerek yok:

```js
// node --env-file=.env.local -e "…"
const { hashSync } = require('@node-rs/argon2');
const pg = require('pg');
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
await c.query(
  `insert into garden.account (email, password_hash, email_verified_at, name, avatar_hex)
   values ('wren@example.com', $1, now(), 'Wren', '#4F7FBF')`,
  [hashSync('meadow-seven-days', { algorithm: 2 })],
);
```

`algorithm: 2` argon2id demek; `Algorithm` bir `const enum` ve
`isolatedModules` altında değer olarak erişilemiyor (bkz.
`lib/server/password.ts`).

**Temizlik:** `delete from garden.account where email like '%@example.com'`
(kelebekler, oturumlar ve token'lar `on delete cascade` ile gidiyor),
`delete from garden.butterfly`, sayacı 27'ye geri al.

⚠ **TAZE ÇEREZ KABI GEREKTİĞİNDE farklı bir host kullan.** Misafirin günlük
hakkı ve şifre sıfırlama çerezi `httpOnly`, yani JavaScript ile silinemiyor.
`localhost:3000`, `127.0.0.1:3000` ve makinenin LAN adresi (`npm run dev`
çıktısındaki "Network") tarayıcı için AYRI çerez kapları — misafir kontenjanı
ve yem kelebek yolu böyle test edildi.

**Durum hâllerini açan kanca** (yalnızca geliştirmede; durum kodlarının ne
olduğu CLAUDE.md'de):

```js
__garden.clearButterflies()                  // D1
__garden.failNext({ kind: 'guest-limit' })   // D3
__garden.failNext({ kind: 'slots-full' })    // D4
__garden.failNext({ kind: 'meadow-full' })   // D4 — çayır dolu
__garden.failNext({ kind: 'network' })       // D5
__garden.failNext({ kind: 'credentials' })   // D6
__garden.sceneStatus('unsupported')          // D8  ('ready' geri alır)
```

⚠ **Mobil doğrulamayı KULLANICI yapmak zorunda.** Asistanın tarayıcı aracı
pencereyi yeniden boyutlandıramıyor ve iframe yolu `X-Frame-Options: DENY`
ile kapalı — başlık DOĞRU, mobil denemek için kaldırılmamalı.
