# Eksikler ve açık işler

**Bu dosyada YALNIZCA yapılmamış işler var.** Biten bir iş buradan siliniyor;
ondan geriye kalması gereken bir kural varsa `CLAUDE.md`'ye taşınıyor.

Son güncelleme: 22 Ağustos 2026.

Aşamalı sıra `ROADMAP.md` → Bölüm II'de. Aşağısı o sıranın açık kalemleri.

---

## Durum özeti

**Tasarım işi kalmadı.** Bütün ekranlar, durum hâlleri, mobil yerleşim, odak
yönetimi ve metinler tamam. Sahne canlı: kelebek salınıyor, izleniyor, soluyor.

**Sunucu bitti (E).** Kimlik, salma, kontenjanlar, listeler, hesap silme ve
iletişim formu gerçek. **Ömür de işliyor (F):** yedi günü dolan kelebek
listeden düşüyor, yuva boşalıyor, veda ekranı gerçek bir olaya bağlı, profil
kilidi sunucuda ve rengi silen günlük süpürme yazıldı.

Kalanlar: kötüye kullanıma karşı ikinci sıra korumalar (§1) ve yayın
hazırlığı (§5).

| | |
|---|---|
| Ekranlar | Karşılama, misafir salma, onay, giriş/kayıt, hesap kurulumu, çayır, kanat seçimi, kelebeklerim, geçmiş, hesabım, ayarlar, veda, 4 yasal sayfa |
| Sahne | Canlı three.js sakura çayırı: 60 yerleşik + 20 misafir + 120 üye yuvası |
| Mobil | 390px'te denendi |
| Veritabanı | Postgres (Neon, Frankfurt). Şema `garden`; `npm run migrate` |
| Zamanlanmış iş | `app/api/cron/sweep` — Vercel Cron, günde bir (`vercel.json`) |

---

## 1. Sunucu

Aşama E bitti; kalan kalemler kötüye kullanım ve sertleştirme tarafında.

### 1.1 Kimlik

- **Google ile giriş.** Buton çizili ama bağlı değil ve bu yüzden DEVRE DIŞI
  duruyor. Kendi auth'umuzu yazdığımız için OAuth akışını da yazmak gerekiyor
  (~150 satır, kütüphane gerekmez).
- **Cloudflare Turnstile GİRİŞTE ve KAYITTA yok.** Sunucu tarafı hazır
  (`lib/server/turnstile.ts`) ve iletişim formunda çalışıyor; giriş kartına
  bağlanması ayrı bir iş — site anahtarının `app/page.tsx`ten `Garden`a, oradan
  `SignInCard`a geçmesi gerekiyor (`NEXT_PUBLIC_` yok, prop olarak).
- **Deneme kısıtı IP başına da olmalı.** Bugün yalnızca e-posta anahtarıyla
  (`garden.sign_in_attempt`) ve bu, adresini bilen birinin bir hesabı kasten
  kilitlemesine açık. Kilit kısa ömürlü olduğu için zarar da kısa ömürlü, ama
  asıl çözüm IP. Özetleme yolu artık hazır (`lib/server/contact.ts` →
  `hashIp`).
- **CSRF için ayrı bir token yok.** Bugünkü koruma `SameSite=Lax` çerez +
  Server Action'ların kendi POST protokolü; başka sitenin gönderdiği bir forma
  çerez eklenmiyor. Güvenlik başlıkları ve tam CSP yazıldı
  (`next.config.mjs`, kurallar CLAUDE.md'de).
- **Şifre gücü yalnızca uzunluğa bakıyor** (`PASSWORD_MIN` = 10). Handoff sızmış
  şifre listesine bakılmasını da istiyor.
- **Kısa şifrenin sunucu reddi `credentials` diline düşüyor** ve bu tam oturan
  bir eşleşme değil — "şifren kurallara uymuyor" diye çizilmiş bir hâl yok.
  Arayüzden ulaşılamayan bir yol olduğu için bugün sorun değil.

### 1.2 Salma ve tavanlar

- **IP başına kısıt yok.** Günlük hak yalnızca çerezde ve çerez silinebilir —
  kabul edilmiş bir şey (asıl koruma kontenjan tavanı), ama salma tek
  kimliksiz yazma noktası ve handoff IP başına da sınır istiyor.
- **İsim moderasyonu yok.** Kelebek isimleri başkalarına görünen kullanıcı
  içeriği; handoff Unicode normalizasyonu, sıfır genişlikli karakterlerin
  ayıklanması, küfür/hakaret listesi ve kaldırılabilir bir moderasyon kuyruğu
  istiyor. Bugün yalnızca uzunluk kontrol ediliyor.

### 1.3 Listeler ve canlılık

- **Listeler yalnızca giriş anında ve sayfa açılışında çekiliyor.** Başka bir
  sekmede salınan kelebek bu sekmenin çayırında görünmüyor. Bugün sorun değil
  (çayır sessiz bir yer), ama "canlı" hissi isteniyorsa periyodik bir
  yenileme gerekir. Ömrün dolması bunun istisnası: onu istemci kendisi
  düşürüyor (`Garden`daki 30 saniyelik tur).
- ⚠ **Ömrün dolması TARAYICININ SAATİNE bakıyor.** Karşılaştırılan iki uç da
  sunucudan geliyor ama "şimdi" istemcinin; saati epeyce şaşmış bir tarayıcı
  kelebeği erken ya da geç düşürür. Yenilemede sunucu düzeltiyor, o yüzden
  bugün kozmetik.
- **Köprüde `recolor` yok.** Fark hesabı `id` üzerinden bakıyor; var olan bir
  kelebeğin rengi değişirse sahneye yansımaz. Bugün renk salındıktan sonra
  değişmediği için sorun değil.

### 1.4 İletişim formu

Uç nokta, saklama, saatlik kısıt ve bot kontrolü yazıldı (`app/actions/contact.ts`).
Kalanlar:

- **Üretimde Turnstile anahtarları gerekiyor.** `TURNSTILE_SITE_KEY` /
  `TURNSTILE_SECRET_KEY` boşken kontrol YAPILMIYOR ve form açık kalıyor —
  bilinçli bir tercih (bkz. `lib/server/turnstile.ts`), ama üretimde bir eksik.
- **`CONTACT_TO` boşsa mesaj `MAIL_FROM`a düşüyor**, o da okunan bir kutu
  olmayabilir. Gerçek bir kutu tanımlanmalı.
- **Mesajların saklama süresi belirsiz.** Gizlilik metni "cevaplayabilmek için
  duruyor" diyor ama silen bir iş yok; süpürmeye bir kural eklenmeli (ör. bir
  yıl) ve metin o süreyi söylemeli.
- **Gönderenin adresi doğrulanmıyor.** Cevap yazan kişi adresi görüp bilerek
  seçiyor (`reply_to` bilerek kullanılmıyor); yine de yanlış kişiye yazma
  riski insanın elinde.
- **Gelen kutusu arayüzü yok.** Mesajlar tabloda duruyor, okunması SQL ile.

---

## 2. Sunucu gelince kaldırılacaklar

- **`window.__garden` geliştirme kancası.** Üretimde derlenmiyor ve artık
  hâllerin çoğu gerçekten oluşabiliyor (D1, D3, D4, D6); yalnızca WebGL'siz
  tarayıcı hâli (D8) ile ulaşılması zor redler için duruyor.

---

## 3. Kalan ufak işler

- Sahnenin düşük kalite profiline geçmesi (`pickQuality` 900px'e bakıyor).
- Kanat renk örnekleri hâlâ 28px; dokunma hedefi 44px'e çıkarılabilir.
- `daysLeft()` hâlâ istemcide hesaplanıyor ve yalnızca ilerleme çubuğunu
  çiziyor; uygunluk kararı zaten sunucuda.

---

## 4. Karar bekleyenler

**Renk seçicide doygunluk alt sınırı.** Soluk bir renk seçen kullanıcı
kelebeğini çayırda kaybediyor. Serbest hex girişi duruyor, sınır konmadı.

**Üye kontenjanının büyümesi.** 120 yuva ≈ aynı anda en fazla 24 üyenin beş
kelebeği. `meadow-full` bir güvenlik supabı, çözüm değil; ürün büyürse ilk
sıkışacak yer burası.

---

## 5. Yayına çıkmadan önce zorunlu

- **Yasal metinler gerçek değil.** Sade dille ve ürünün gerçek davranışına
  göre yazıldı (22 Ağustos'ta sitenin bugünkü mimarisine göre yenilendi) ama
  hukuki inceleme görmedi; KVKK/GDPR sürümleriyle değişmeli. Veri olarak
  duruyorlar (`lib/legal.ts`), JSX değil.
- **KTX2 (VRAM) yapılmadı.** Bütün varlıklar PNG'den WEBP'ye çevrildi ve
  `public/` 14,2 MB → 3,2 MB indi (modeller 6,0 → 1,5; atlaslar 4,8 → 1,4;
  poster 3,5 → 0,2). Bu yalnızca İNDİRME kazancı: WebP de GPU'ya ham RGBA
  olarak çıkıyor, yani çim atlası hâlâ 24 MB VRAM istiyor. Onu düşürmenin yolu
  KTX2/Basis ve encoder (`toktx`, KTX-Software) makinede kurulu değil — npm'de
  tarayıcı dışı bir karşılığı da yok. Kurulursa dönüşüm ve `KTX2Loader`
  bağlanması yarım günlük iş.
- **Üretim ortam değişkenleri:**
  - `DATABASE_URL` (üretim veritabanı, pooled), `APP_URL` (alan adı)
  - `RESEND_API_KEY` + `MAIL_FROM` — boş kalırsa kaydolan herkes hiç
    açılmayacak bir kapının önünde kalır
  - `CONTACT_TO` — iletişim mesajlarının düşeceği kutu
  - `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` — boşken bot kontrolü yok
  - `IP_HASH_SECRET` — boşken IP özeti anahtarsız üretiliyor
  - `CRON_SECRET` — **boşken süpürme HİÇ çalışmıyor** (uç nokta her isteği
    reddediyor) ve renk silme sözü tutulmaz
- **Cron dağıtımdan sonra doğrulanmalı.** `vercel.json` günde bir çağırıyor;
  Vercel'in Hobby planı günlük sıklıktan fazlasına izin vermiyor.

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

⚠️ Uzun süre açık kalan dev sunucusunun statik render işçisi çökebiliyor:
`/legal/*` rotaları 500 dönüp `Jest worker encountered 2 child process
exceptions` diyor, `/` çalışmaya devam ediyor. Kodla ilgisi yok — sunucuyu
yeniden başlatmak çözüyor.

### Veritabanıyla çalışmak

**Şema:** `npm run migrate` — `psql` gerekmiyor. Yeniden çalıştırmak zararsız;
uygulananlar `garden.migration` defterinde.

**Postalar konsola basılıyor** (doğrulama, şifre sıfırlama ve iletişim
mesajları dev sunucusunun çıktısında). Resend anahtarı gerekmiyor.

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

**Ömrün dolmasını denemek** için kelebeği yaşlandır — beklemek gerekmiyor:

```sql
update garden.butterfly set expires_at = now() - interval '1 minute'
 where owner_id = (select id from garden.account where email = 'wren@example.com');
```

Çayır ekranında en geç 30 saniye içinde veda ekranı açılıyor.

**Süpürmeyi elle çalıştırmak** (`.env.local`de `CRON_SECRET` dolu olmalı):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sweep
```

**Temizlik:** `delete from garden.account where email like '%@example.com'`
(kelebekler, oturumlar ve token'lar `on delete cascade` ile gidiyor; iletişim
mesajları `set null` ile KALIYOR), `delete from garden.butterfly`,
`delete from garden.contact_message`, sayacı 27'ye geri al.

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
