# Eksikler ve açık işler

Butterfly Garden'ın şu anki durumu ve neyin yapılmadığı.
Son güncelleme: 21 Ağustos 2026.

**Tasarım turu bitti.** Bütün ekranlar çizildi, stiller `app/styles/` altına
rolüne göre bölündü ve mobil 390px'te gerçekten denenip tamamlandı.

Bundan sonrası tasarım değil **davranış**: kelebeğin gerçekten çayıra
çıkması, salındıktan sonra izlenebilmesi ve hesabın arkasına bir sunucu
konması. Aşağıdaki sıra öncelik sırası.

---

## Durum özeti

Sunucu yok; oturum, kelebek listesi ve sayaç bellekte yaşıyor ve sayfa
yenilenince sıfırlanıyor.

| | |
|---|---|
| Ekranlar | Karşılama, misafir salma, onay, giriş/kayıt, hesap kurulumu, çayır, kanat seçimi, kelebeklerim, geçmiş, hesabım, ayarlar, veda, 4 yasal sayfa |
| Sahne | Canlı three.js sakura çayırı, 60 yerleşik kelebek — hepsi rastgele, hiçbiri kullanıcıya ait değil |
| Mobil | 390×640 ve 390×844'te denendi, tamamlandı |
| Stiller | `app/styles/` altında role göre bölündü; bileşenlerde yardımcı sınıf yığını kalmadı (bkz. CLAUDE.md) |
| Build | `npm run build` geçiyor, `tsc --noEmit` temiz |

---

## 1. Salınan kelebek çayıra HİÇ çıkmıyor

Ürünün tek vaadi bu ve çalışmıyor. Kullanıcı rengini seçiyor, ismini
yazıyor, "released" ekranını görüyor — ama çayırda uçan şey hâlâ açılışta
rastgele üretilmiş 60 kelebekten biri. Salınan kelebek yalnızca React
durumunda bir satır.

Kopukluk tek bir yerde: **sahne handle'ı React'e hiç çıkmıyor.**

- `components/meadow/Meadow.tsx` `createMeadow()`'un döndürdüğü nesneden
  yalnızca `dispose`'u saklıyor. `swarm`, `flight`, `world` atılıyor.
- `components/Garden.tsx:194` `releaseAsMember()` kelebeği `setButterflies`
  ile listeye ekliyor ve orada bitiyor.

Motor tarafı buna hazır, eksik olan köprü:

| Var olan | Nerede |
|---|---|
| `Swarm.setWingTint(i, fore, hind)` — bir instance'ın kanadına tam renk (ton + doygunluk + parlaklık) | `src/swarm/Swarm.js` |
| `wingTintFromColor(hex)` — hex'ten o üçlüye | `src/world/swarm.js:151` |
| `capacity: 200` ama `count` 60 — ziyaretçi kelebekleri için havuz zaten ayrılmış, `setCount()` yeniden ayırma yapmıyor | `src/world/swarm.js:110` |

Yapılacaklar:

- Sahne handle'ını bir ref'te tutup React'e bir **çayır API'si** olarak
  vermek (`release(butterfly)`, `remove(id)`, `focus(id)`). Bileşenlerin
  `swarm`'ı doğrudan ellememesi önemli; motorun React'ten habersiz kalması
  bilinçli bir karar.
- **`butterfly.id → instanceIndex` kayıt defteri.** Salınan kelebek havuzdan
  bir yuva alıyor, rengi ve ölçüsü oraya yazılıyor. Liste değiştiğinde
  (yenisi geldi, biri ömrünü doldurdu) eşleme bozulmamalı — §2 tamamen buna
  dayanıyor.
- Salma anının sahnede bir karşılığı olması: kelebek yerden ya da ekran
  kenarından girmeli, hiç yoktan belirmemeli.
- Yenilemede kalıcılık: liste sunucudan gelene kadar kelebek her `F5`'te
  kayboluyor.

---

## 2. Salınan kelebeği izleme

Ekranlar hazır, ikisi de sahneye bağlanmayı bekliyor:

- **Kelebeklerim satırındaki `Watch`** şu an yalnızca izleme kipine geçiyor
  (kartı gizleyip çayırı açıyor), kameraya kelebeği göstermiyor.
- **Onay ekranındaki "Follow X in the meadow"** aynı şekilde, sadece çayıra
  dönüyor.

Gereken: §1'deki eşleme + o instance'ın dünya konumunu her kare okuyup
kameranın takip etmesi, `OrbitControls` sınırlarının takip kipinde
gevşetilmesi ve izleme bitince kameranın yumuşak dönüşü.

Buna bağlı iki iş daha:

- **Kelebeklerin solması.** Yedi günlük ömrün görsel karşılığı (küçülme +
  dithered kesme) sahnede yazılmadı. ⚠ `injectFlapShader` materyal ömrü
  boyunca yalnızca bir kez çağrılıyor; solma kodu **aynı enjeksiyonun
  içine** yazılmalı (bkz. CLAUDE.md).
- **Ömrü biten kelebeğin yuvasını havuza geri vermesi.**

---

## 3. Hesap: kayıt, giriş, güvenlik

Şu an giriş diye bir şey yok — `Garden.tsx:209` `completeSignIn()` e-postayı
alıp kendi kafasından `Wren` adında bir profil uyduruyor. Şifreye hiç
bakılmıyor, oturum yok, yenileyince her şey gidiyor.

Sunucu tarafında gereken:

- Gerçek hesap: e-posta + şifre, şifre **hash'lenmiş** (argon2id/bcrypt),
  e-posta doğrulama, şifre sıfırlama.
- Oturum: `httpOnly`, `Secure`, `SameSite=Lax` çerez. Token'ı istemci
  belleğinde tutma.
- **Giriş hatası tek mesaj:** "email or password is wrong". E-postanın
  kayıtlı olup olmadığını ele veren ayrı bir mesaj yok (kullanıcı sayımına
  izin verir).
- **Hız sınırı.** Girişte deneme sınırı; misafir salmada **IP başına**
  günlük sınır. Misafir salma tek kimliksiz yazma noktası — en sıkı korumayı
  o istiyor. Arayüz hazır (`GUEST_DAILY_LIMIT`, dolduğunda buton *One a day*
  olup kilitleniyor) ama sayaç istemcide, yenileyince sıfırlanıyor.
- **Yetki kontrolü her uç noktada.** Kelebek silme/düzenleme sahibine bağlı
  olmalı; `id` tahmin edilebilir olmamalı.
- **Uygunluğu istemci hesaplamıyor**: kalan gün, yuva sayısı, günlük hak —
  hepsi sunucudan gelen değerler. `daysLeft()` yalnızca çubuğu çiziyor.
- **Ayarlardaki 1 günlük renk kilidi** sunucuda uygulanmalı; `lockedUntil`
  prop'u duruyor ama kimse doldurmuyor ve istemcideki tarih yenilemede
  sıfırlanır.
- CSRF, güvenlik başlıkları ve tam CSP (bkz. §8).

---

## 4. İletişim formu (contact us)

`components/legal/ContactForm.tsx` hiçbir yere göndermiyor — gönderim
yalnızca `setSent(true)` yapıyor.

- Gerçek bir uç nokta + e-posta gönderimi.
- Bal küpü alanı var; **Turnstile/captcha ve IP başına sınır yok.**
- Gönderenin adresi doğrulanmıyor: yanıt yazılacaksa ilişkilendirme sunucuda
  yapılmalı.

---

## 5. Hesap silme

Arayüz tarafı **bitti**: `SettingsCard` bir onay adımı gösteriyor ve
kullanıcı hesap ismini yazmadan `Delete for good` açılmıyor
(`typed !== profile.name` iken `disabled`). "Emin misiniz" penceresi
refleksle geçildiği için eşik bilerek isim yazmak.

Eksik olan tamamen sunucu tarafı — `Garden.tsx:221` `deleteAccount()` şu an
yalnızca durumu temizliyor:

- Hesabın ve ona bağlı verinin gerçekten silinmesi (kelebekler, geçmiş,
  iletişim kayıtları).
- Kelebeklerin çayırdan **anında** kalkması — uyarı metninin verdiği söz bu.
- Bütün oturumların sonlandırılması.
- Silmeden önce yeniden kimlik doğrulama (şifre). İsim yazmak arayüz eşiği,
  yetki kanıtı değil.
- Silme kalıcı mı yoksa kısa bir geri alma penceresi mi var — karar
  verilmedi; gizlilik metniyle uyuşmalı (bkz. §7).

---

## 6. Kalan tasarım işleri

Mobil bitti; şunlar açık kaldı.

### 6.1 Ele alınmamış durumlar

- **Hiç kelebek yok** — beş yuvanın da boş olduğu hâl (çalışıyor ama
  tasarlanmadı; sadece "room for 5 more butterflies" yazıyor)
- **Salma başarısız** — hız sınırına takılma, tavan dolu
- **Bağlantı yok / yükleniyor** — sahne yüklenirken ne görünüyor

### 6.2 Kelebek çizimi geliştirilebilir

`components/Butterfly.tsx` çizildi; ön/arka kanat ayrı yollar, sol kanatlar
sağın aynası. Ama profesyonel bir illüstrasyon değil — kanat formu basit.
Üç boyutta kullanılıyor: salma önizlemesi (~124×100), profil avatarı
(19–42px), liste satırı (~33×24). Değiştirilecekse tek dosya yeter.

### 6.3 Kart geçişlerinde odak yönetimi

Kart değiştiğinde klavye odağı sıfırlanmıyor; sekme tuşuyla gezen biri yeni
kartın başına değil sayfanın başına dönüyor. İzleme kipinde `inert` eklendi
ama kartlar arası geçişte odak taşınmıyor.

### 6.4 Ufak tefek

- Sahnenin düşük kalite profiline geçmesi (`pickQuality` 900px'e bakıyor)
- Kanat renk örnekleri hâlâ 28px; dokunma hedefi 44px'e çıkarılabilir
- **Taslak kaybı:** yarım kalmış kelebek (seçilmiş renkler, yazılmış isim)
  sayfa yenilenince kayboluyor. `sessionStorage` ile korunabilir.

---

## 7. Karar bekleyenler

**History ve gizlilik metni çelişkisi.** Metinde "yedi günü dolan kayıt
silinir" yazıyor; geçmiş listesi onu saklamayı gerektiriyor. Karar verildi:
metin güncellenecek — ama henüz yazılmadı (`lib/legal.ts`). §5'teki silme
politikası da aynı metne bağlı.

**History verisi.** Ekran hazır ve boş durumu gösteriyor; ömrünü tamamlamış
kelebek listesi sunucudan gelecek.

**Renk seçicide doygunluk alt sınırı.** Soluk bir renk seçen kullanıcı
kelebeğini çayırda kaybediyor. Serbest hex girişi duruyor, sınır konmadı.

---

## 8. Yayına çıkmadan önce zorunlu

- **Depo private yapılmalı.** Şu an herkese açık. Handoff bunu şart koşuyor;
  `design_handoff_butterfly_garden/` bu yüzden commit'lenmedi.
- **Yasal metinler gerçek değil.** Sade dille yazılmış yer tutucu; KVKK/GDPR
  incelemesinden geçmiş sürümlerle değişmeli. Veri olarak duruyorlar
  (`lib/legal.ts`), JSX değil, yani değiştiren kişinin React bilmesi
  gerekmiyor.
- **Inkwell atıfı.** MIT lisansı telif bildiriminin korunmasını şart koşuyor;
  `public/textures/CREDITS.txt` var ama sitenin atıf sayfasına da girmeli.
- **Model dosyaları ~6 MB ham PNG doku.** KTX2'ye çevrilip küçültülmeli.
- **CSP başlıkları.** `next.config.mjs`'te temel başlıklar var; three.js için
  `worker-src blob:` gereken tam CSP yazılmadı.

---

## Notlar

**Geliştirme sunucusu:** `npm run dev` → http://localhost:3000
(port doluysa Next kendisi bir sonrakine geçiyor, çıktıya bak)
**Laboratuvarlar:** `npm run lab` (hâlâ Vite üzerinde) — `index.html`,
`lab.html`, `world.html`

⚠️ Build alacaksan önce dev sunucusunu durdur. İkisi aynı `.next` klasörüne
yazıyor; birlikte çalıştıklarında CSS tamamen kaybolabiliyor.
