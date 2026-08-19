# Eksikler ve açık işler

Butterfly Garden'ın şu anki durumu ve neyin yapılmadığı.
Son güncelleme: 19 Ağustos 2026.

Öncelik şu an **tasarım**. Backend ve davranış işleri bilinçli olarak
bekletiliyor, aşağıda ayrı başlıkta.

---

## Durum özeti

Handoff'un iki turu da uygulandı. Sunucu yok; oturum, kelebek listesi ve
sayaç bellekte yaşıyor ve sayfa yenilenince sıfırlanıyor.

| | |
|---|---|
| Ekranlar | Karşılama, misafir salma, onay, giriş/kayıt, hesap kurulumu, çayır, kanat seçimi, kelebeklerim, geçmiş, hesabım, ayarlar, veda, 4 yasal sayfa |
| Sahne | Canlı three.js sakura çayırı, 60 yerleşik kelebek |
| Build | `npm run build` geçiyor, `tsc --noEmit` temiz |

---

## A. Tasarım eksikleri

Sırayla, en önemliden.

### A1. Mobil hiç doğrulanmadı ⚠️

**Bu listedeki en büyük boşluk.** Duyarlı sınıflar (`max-lg:` / `lg:`)
yazıldı: tek sütun, kartlar alt sayfaya dönüyor, perde yönü dikeye
çevriliyor, 900px kırılma noktası. Ama **390px'te hiç bakılmadı** — tarayıcı
penceresini küçültemedim.

Yani mobil "yazıldı" ama "görülmedi". Kontrol edilmesi gerekenler:

- Kartların alt sayfa hâli, 22px üst köşe yarıçapı
- 44–54px dokunma hedefleri, 44px renk örnekleri
- Alta ortalanmış yasal bağlantılar
- Kanat seçimi kartının 390px'e sığması (renk seçici popover'ı dahil)
- Sayaç ve hesap rozetinin mobilde yeri
- `Watch the meadow` düğmesinin sağ kenarda mobilde çalışması
- Sahnenin düşük kalite profiline geçmesi (`pickQuality` 900px'e bakıyor)

Tasarımda iki mobil çerçeve var (karşılama, kanat seçimi + isim); onlar
referans.

### A2. ~~WebGL yedek görseli yok~~ — çözüldü

`public/meadow-fallback.png` eklendi ve `next/image` ile servis ediliyor.
Kaynak 2124×1464 ve 3.5 MB; Next isteyen ekrana göre küçültüp WebP'ye
çeviriyor. Yalnızca WebGL bulunamadığında isteniyor, normal kullanıcı
indirmiyor.

### A3. Kelebek çizimi geliştirilebilir

Handoff "düzgün bir kelebek SVG'si çizdirin" diyordu; çizildi
(`components/Butterfly.tsx`) ve ön/arka kanat ayrı yollar, sol kanatlar
sağın aynası. Ama profesyonel bir illüstrasyon değil — kanat formu basit.

Üç boyutta kullanılıyor: salma önizlemesi (~124×100), profil avatarı
(19–42px), liste satırı (~33×24). Değiştirilecekse tek dosya yeter.

### A4. Ele alınmamış durumlar

Handoff'ta "kapsanması gereken" diye geçen, henüz çizilmemiş ekranlar:

- **Hiç kelebek yok** — beş yuvanın da boş olduğu hâl (şu an çalışıyor ama
  tasarlanmadı; sadece "room for 5 more butterflies" yazıyor)
- **Salma başarısız** — hız sınırına takılma, tavan dolu
- **Giriş hatası** — "email or password is wrong" (kullanıcı sayımına izin
  vermeyen tek mesaj)
- **Bağlantı yok / yükleniyor** — sahne yüklenirken ne görünüyor

### A5. Kart geçişlerinde odak yönetimi

Kart değiştiğinde klavye odağı sıfırlanmıyor; sekme tuşuyla gezen biri
yeni kartın başına değil, sayfanın başına dönüyor. İzleme kipinde `inert`
eklendi ama kartlar arası geçişte odak taşınmıyor.

---

## B. Bilerek bekletilenler

Bunlar tasarım değil, davranış. Sıraları sende.

| İş | Not |
|---|---|
| **Watch → kelebeğe kilitlenme** | Satırdaki `Watch` şu an sadece izleme kipine geçiyor. Kamerayı o kelebeğe kilitlemek `butterfly.id → instanceIndex` eşlemesi istiyor. |
| **Onaydaki "Follow X in the meadow"** | Aynı şekilde, şu an sadece çayıra dönüyor. |
| **History verisi** | Ekran hazır ve boş durumu gösteriyor; ömrünü tamamlamış kelebek listesi sunucudan gelecek. |
| **Ayarlardaki 1 günlük kilit** | Arayüz hazır (`lockedUntil` prop'u var) ama kimse doldurmuyor. Kilidi sunucu uygulamalı — istemcideki tarih yenilemede sıfırlanır. |
| **İletişim formu** | Hiçbir yere göndermiyor. Bal küpü alanı var, Turnstile ve IP sınırı yok. |
| **Misafir günlük limiti** | Arayüz hazır: günde 1 kelebek, dolduğunda buton *One a day* olup kilitleniyor. Ama sayaç istemcide — sayfa yenilenince sıfırlanıyor. Gerçek sınır sunucuda, **IP başına** olmalı; misafir salma tek kimliksiz yazma noktası, en sıkı korumayı o istiyor. |
| **Kelebeklerin solması** | 7 günlük ömrün görsel karşılığı (küçülme + dithered kesme) sahnede yazılmadı. |
| **Taslak kaybı** | Yarım kalmış kelebek (seçilmiş renkler, yazılmış isim) sayfa yenilenince kayboluyor. `sessionStorage` ile korunabilir. |

---

## C. Karar bekleyenler

**~~Misafir kelebeğinin ismi~~** — karar verildi. Otomatik isim
uydurulmuyor; misafir onayı *"Your butterfly is flying."* diyor. Sebep
tutarlılık: misafir kelebeğini takip edemiyor, ona isim vermek takip
edilebilirmiş izlenimi yaratırdı.

**"signed in with email" satırı.** Yeni tasarımda hâlâ var, sen kaldırmamı
istemiştin, kaldırıldı. (Onaylandı, kapandı.)

**History ve gizlilik metni çelişkisi.** Metinde "yedi günü dolan kayıt
silinir" yazıyor; geçmiş listesi onu saklamayı gerektiriyor. Metin
güncellenecek. (Karar verildi, yazılacak.)

**Renk seçicide doygunluk alt sınırı.** Motor rengi ton döndürmesi olarak
uyguluyor; soluk bir renk seçen kullanıcı kelebeğini çayırda kaybediyor.
Serbest hex girişi duruyor, sınır konmadı.

---

## D. Yayına çıkmadan önce zorunlu

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
**Kanat laboratuvarı:** `npm run lab` (hâlâ Vite üzerinde)

⚠️ Build alacaksan önce dev sunucusunu durdur. İkisi aynı `.next` klasörüne
yazıyor; birlikte çalıştıklarında CSS tamamen kaybolabiliyor.
