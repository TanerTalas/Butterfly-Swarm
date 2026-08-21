# Eksikler ve açık işler

**Bu dosyada YALNIZCA yapılmamış işler var.** Biten bir iş buradan siliniyor;
ondan geriye kalması gereken bir kural varsa `CLAUDE.md`'ye taşınıyor.

Son güncelleme: 21 Ağustos 2026.

Aşamalı sıra `ROADMAP.md` → Bölüm II'de. Aşağısı o sıranın açık kalemleri.

---

## Durum özeti

**Tasarım işi kalmadı.** Bütün ekranlar, durum hâlleri, mobil yerleşim, odak
yönetimi ve metinler tamam. Sahne canlı: kelebek salınıyor, izleniyor,
soluyor.

⚠ **SUNUCU YOK.** Oturum, kelebek listesi ve sayaç `Garden` içinde yaşıyor ve
sayfa yenilenince sıfırlanıyor. Kalan işlerin neredeyse tamamı buna bağlı.

| | |
|---|---|
| Ekranlar | Karşılama, misafir salma, onay, giriş/kayıt, hesap kurulumu, çayır, kanat seçimi, kelebeklerim, geçmiş, hesabım, ayarlar, veda, 4 yasal sayfa |
| Sahne | Canlı three.js sakura çayırı: 60 yerleşik + 20 misafir + 120 üye yuvası |
| Mobil | 390px'te denendi |
| Build | `npm run build` geçiyor (8/8 sayfa), `tsc --noEmit` temiz |

---

## 1. Sunucu

Şu an giriş diye bir şey yok — `Garden.tsx` `completeSignIn()` e-postayı alıp
kendi kafasından `Wren` adında bir profil uyduruyor. Şifreye hiç bakılmıyor,
oturum yok, yenileyince her şey gidiyor.

### 1.1 Kimlik

- Gerçek hesap: e-posta + şifre, şifre **hash'lenmiş** (argon2id/bcrypt),
  e-posta doğrulama, şifre sıfırlama.
- Oturum: `httpOnly`, `Secure`, `SameSite=Lax` çerez. Token'ı istemci
  belleğinde tutma.
- **Giriş hatası tek mesaj:** "email or password is wrong". E-postanın
  kayıtlı olup olmadığını ele veren ayrı bir mesaj yok (kullanıcı sayımına
  izin verir).
- **Cloudflare** girişte ve kayıtta. Bot koruması bizim yazacağımız bir şey
  değil.
- **Yetki kontrolü her uç noktada.** Kelebek silme/düzenleme sahibine bağlı
  olmalı; `id` tahmin edilebilir olmamalı.
- CSRF, güvenlik başlıkları ve tam CSP (bkz. §5).
- **Kayıt doğrulama hâli çizili ama BAĞLANMADI.** `SignInCard`ın
  `status="verify"` prop'u hazır; kayıt bugün doğrudan hesap kurulumuna
  gidiyor. Posta gönderimi olmadan akışı oraya sokmak, kayıt olanı hiç
  açılmayacak bir kapının önünde bırakırdı.

### 1.2 Salma ve tavanlar

- **Misafir günlük hakkı bir ÇEREZDE.** Çerez silinebilir ve bu kabul edilmiş
  bir şey; asıl koruma misafir kontenjanının tavanı (bkz. CLAUDE.md).
  Arayüz hazır: `GUEST_DAILY_LIMIT`, dolduğunda buton *One a day* olup
  kilitleniyor.
- **Kontenjanlar sunucuda da geçerli olmalı**: kişi başı 5 üye kelebeği,
  çayırda 20 misafir + 120 üye yuvası. Sahne bunları kendi tarafında zaten
  uyguluyor ama sahne bir GÖRÜNÜM — kural sunucunun.
- **Red cevapları `ReleaseFailure` şekline oturmalı** (`lib/types.ts`):
  `guest-limit`, `slots-full`, `meadow-full`, `network`. Dördünün de arayüz
  karşılığı çizili ve çalışıyor.
- **Uygunluğu istemci HESAPLAMIYOR**: kalan gün, yuva sayısı, günlük hak —
  hepsi sunucudan gelen değerler. `daysLeft()` yalnızca çubuğu çiziyor.
- **Misafir kelebeğinin rengi sunucuda çekilsin.** Bugün istemcide
  (`Garden.releaseAsGuest`) ve kullanıcı yeniden deneyerek istediği rengi
  tutturabiliyor.
- **Sayacın 27'lik tohumu sunucuya taşınmalı.** Şu an `app/page.tsx`'te;
  orada kaldığı sürece her sekme kendi 27'sinden başlıyor ve sayaç küresel
  bir toplam olmaktan çıkıyor.

### 1.3 Liste ve kalıcılık

- **Yenilemede kayboluyor.** Liste bellekte; `F5` çayırı yerleşiklere
  döndürüyor.
- **Çıkışta kelebekler çayırdan kalkıyor** (`Garden.tsx` `signOut`) ve bu
  DOĞRU DEĞİL: salınan kelebek çayırın, salanın değil. Oturum kapansa da
  uçmalı. Listeyi tutan kimse olmadığı için şimdilik kalkıyorlar; liste
  sunucudan gelince o satır kalkacak.
- **History verisi.** Ekran hazır ve boş durumunu gösteriyor; ömrünü
  tamamlamış kelebek listesi sunucudan gelecek. Saklanan şey isim ve tarih —
  renk ve çayırdaki yer gitmiş oluyor (gizlilik metni bunu söylüyor).
- **`seed` alanı şimdiden şemaya konsun.** İstemci bugün onu kimlikten
  türetiyor; sunucudan gelmeye başladığında yalnızca o değer değişecek.
- **`expires_at` MUTLAK bir an olarak saklansın**, "kaç gün" olarak değil
  (bkz. CLAUDE.md — motor ömrün kaç gün olduğunu bilmiyor).

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

Arayüz tarafı bitti: `SettingsCard` onay adımı gösteriyor ve kullanıcı hesap
ismini yazmadan `Delete for good` açılmıyor. Eksik olan tamamen sunucu —
`deleteAccount()` şu an yalnızca durumu temizliyor.

- Hesabın ve ona bağlı verinin gerçekten silinmesi (kelebekler, geçmiş,
  iletişim kayıtları). **Kalıcı, geri alma penceresi yok.**
- Kelebeklerin çayırdan **anında** kalkması — uyarı metninin verdiği söz bu.
- Bütün oturumların sonlandırılması.
- Silmeden önce yeniden kimlik doğrulama (şifre). İsim yazmak arayüz eşiği,
  yetki kanıtı değil.

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
  red cevapları gelince gereksizleşiyor (bkz. Notlar).
- **`Garden.seedButterflies()`** — hesap ekranlarını dolduran üç örnek
  kelebek.

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

---

## Notlar

**Geliştirme sunucusu:** `npm run dev` → http://localhost:3000
(port doluysa Next kendisi bir sonrakine geçiyor, çıktıya bak)
**Laboratuvarlar:** `npm run lab` (Vite) — `index.html`, `lab.html`,
`world.html`

⚠️ Build alacaksan önce dev sunucusunu durdur. İkisi aynı `.next` klasörüne
yazıyor; birlikte çalıştıklarında CSS tamamen kaybolabiliyor.

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
