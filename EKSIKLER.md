# Eksikler ve açık işler

Butterfly Garden'ın şu anki durumu ve neyin yapılmadığı.
Son güncelleme: 21 Ağustos 2026.

**Tasarım turu bitti.** Bütün ekranlar çizildi, stiller `app/styles/` altına
rolüne göre bölündü ve mobil 390px'te gerçekten denenip tamamlandı.

Bundan sonrası tasarım değil **davranış**: kelebeğin gerçekten çayıra
çıkması (✅ §1), salındıktan sonra izlenebilmesi ve hesabın arkasına bir
sunucu konması. Aşağıdaki sıra öncelik sırası.

---

## Durum özeti

Sunucu yok; oturum, kelebek listesi ve sayaç bellekte yaşıyor ve sayfa
yenilenince sıfırlanıyor.

| | |
|---|---|
| Ekranlar | Karşılama, misafir salma, onay, giriş/kayıt, hesap kurulumu, çayır, kanat seçimi, kelebeklerim, geçmiş, hesabım, ayarlar, veda, 4 yasal sayfa |
| Sahne | Canlı three.js sakura çayırı: 60 yerleşik + kullanıcının saldığı ziyaretçiler (§1) |
| Mobil | 390×640 ve 390×844'te denendi, tamamlandı |
| Stiller | `app/styles/` altında role göre bölündü; bileşenlerde yardımcı sınıf yığını kalmadı (bkz. CLAUDE.md) |
| Build | `npm run build` geçiyor, `tsc --noEmit` temiz |

---

## 1. Salınan kelebeğin çayıra çıkması ✅

**Yapıldı.** Salınan kelebek artık gerçekten sahnede: çayırın kenarından
içeri süzülüyor, seçilen renkleri taşıyor ve listeden düştüğünde çayırdan
kalkıyor.

Zincir: `Garden` → `MeadowBridge` (`components/meadow/Meadow.tsx`) →
`createMeadow()` yüzü → `src/world/visitors.js` → `Swarm`. Mimari kurallar
CLAUDE.md'de; özeti:

- Köprü **bildirimsel** (`meadow.sync(list)`), çünkü sahne asenkron iniyor ve
  kullanıcı o inmeden de kelebek salabiliyor.
- Ziyaretçiler `[residentCount, count)` aralığında **bitişik** duruyor; biri
  ayrılınca sondaki `Swarm.copyInstance` ile onun yerine taşınıyor.
- Bileşenler `swarm`'a dokunmuyor; dışarıya yalnızca `release` / `remove` /
  `clearVisitors` / `indexOf` çıkıyor.

Doğrulandı (tarayıcıda, `window.__meadow` üzerinden): misafir salınca
`count` 60→61, üye girişiyle +3 tohum, üye salmasıyla +1; iki renkli kanat
ön/arka ayrı ton alıyor; çıkışta üye kelebekleri kalkıyor, misafir kelebeği
konumunu ve rengini koruyarak uçmaya devam ediyor.

Ayrıca: misafir kelebeğinin rengini artık **çayır çekiyor** (paletten
rastgele, tek renk). Önce her misafir kelebeği turkuaz çıkıyordu ve kartın
"The meadow picks the wings" sözü karşılıksızdı. ⚠ Çekiliş istemcide olduğu
sürece kullanıcı yeniden deneyerek istediği rengi tutturabilir; sunucuya
taşınmalı.

### Bundan artakalanlar

- **Yenilemede kayboluyor.** Liste bellekte; `F5` çayırı yerleşiklere
  döndürüyor. Kalıcılık §3'teki sunucuyla geliyor.
- **Çıkışta kelebekler çayırdan kalkıyor** (`Garden.tsx` `signOut`) ve bu
  doğru değil: salınan kelebek çayırın, salanın değil. Oturum kapansa da
  uçmalı — ama listeyi tutan kimse olmadığı için şimdilik kalkıyorlar.
- **Renk değişimi köprüde ele alınmıyor.** Fark hesabı `id` üzerinden
  bakıyor; var olan bir kelebeğin rengi değişirse sahneye yansımaz. Bugün
  renk salındıktan sonra değişmediği için sorun değil, ayarlardaki kilit
  gerçek bir renk düzenlemesine dönüşürse `recolor` gerekecek.
- **Ölçek ve çırpma hızı yuvadan geliyor**, kelebeğin kendisinden değil:
  hangi yuvaya düştüyse onun boyunu alıyor. Kelebeğe ait bir `seed` (§3'te
  sunucudan) bunu deterministik yapacak.

---

## 2. Salınan kelebeği izleme

Ekranlar hazır, ikisi de sahneye bağlanmayı bekliyor:

- **Kelebeklerim satırındaki `Watch`** şu an yalnızca izleme kipine geçiyor
  (kartı gizleyip çayırı açıyor), kameraya kelebeği göstermiyor.
- **Onay ekranındaki "Follow X in the meadow"** aynı şekilde, sadece çayıra
  dönüyor.

Eşleme **hazır**: `meadow.indexOf(id)` kelebeğin o anki instance indeksini
veriyor ve `butterflyPosition(swarm, i)` (`src/world/swarm.js`) dünya
konumunu okuyor. Eksik olan kamera tarafı: o konumu her kare takip etmek,
`OrbitControls` sınırlarını takip kipinde gevşetmek ve izleme bitince
kamerayı yumuşakça geri getirmek.

⚠ İndeks **saklanmamalı**, her kare sorulmalı — kelebek listeden düştüğünde
taşıma indeksleri kaydırıyor.

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

### 6.1 Durum tasarımları — tek tek

Aşağıdakilerin hepsi **var olan bir ekranın bir durumu**, yeni ekran değil.
Yani her biri kendi kartının içinde çözülecek; ayrı bir sayfa açılmayacak.

Hepsi için geçerli kısıtlar:

- **Kalıp zaten var, yenisini uydurma.** Engelli hâlin dili "Kelebeklerim"de
  ve misafir salmada kurulu: **birincil buton devre dışı + etiketi değişiyor
  + altında nedenini söyleyen tek satır not** (`.note.note--center`). Yeni
  bir uyarı kutusu icat etmeden önce bu kalıbın yetip yetmediğine bak.
- **Renk sözlüğü hazır.** Hata için `--color-danger`, `--line-danger`,
  `--wash-danger` (ayarlardaki silme paneli bunları kullanıyor). Çıplak hex
  yazma.
- **Metin dili:** notlar küçük harfle başlıyor, nokta yok, ünlem yok
  (`you have let one go today · sign in to release more`). Başlıklar cümle
  düzeninde. Suçlayıcı değil, olan biteni söyleyen bir ton.
- **Mobil referans 390px.** Kart orada ekranın altına oturan bir alt sayfa;
  eklenen satır kartı ekran dışına taşırmamalı (bkz. CLAUDE.md).
- Her durumun **ne zaman görüneceği** yazılı; tasarımı yaparken tetikleyiciyi
  değiştirme, çünkü §1–§3'teki sunucu işi bu tetikleyicilere göre yazılacak.

| # | Durum | Hangi ekranın içinde |
|---|---|---|
| D1 | Hiç kelebek yok (0/5) | Kelebeklerim |
| D2 | Geçmiş boş | History |
| D3 | Salma reddedildi — misafir günlük hakkı | Misafir salma |
| D4 | Salma reddedildi — yuvalar dolu | Kanat seçimi |
| D5 | Salma başarısız — ağ/sunucu | Misafir salma + kanat seçimi |
| D6 | Giriş/kayıt hatası | Giriş kartı |
| D7 | Sahne yükleniyor | Çayır (kartsız) |
| D8 | Sahne açılamıyor (WebGL yok) | Çayır (kartsız) |

---

**D1 — Hiç kelebek yok (0/5)**

*Ne zaman:* Üye giriş yaptı, hiç kelebek salmadı ya da hepsinin ömrü doldu.
Şu an ekranda `0/5` sayacı, tek bir "room for 5 more butterflies" satırı ve
`Release another` butonu var — yani boş liste, dolu listenin eksik hâli gibi
okunuyor.

*Ne söylemeli:* Bu bir eksiklik değil, başlangıç. Buton "another" dememeli
(ortada bir öncesi yok). İlk kelebeği salmaya davet eden tek bir çağrı
yeterli; `History` bağlantısı D2 ile birlikte gizlenebilir mi, karar ver.

*Dokunulacak yer:* `components/butterflies/MyButterfliesCard.tsx` —
`used === 0` dalı. Kart genişliği 500.

---

**D2 — Geçmiş boş**

*Ne zaman:* Hiçbir kelebek yedi gününü doldurmamış. Şu an
`nothing has finished its seven days yet` yazan tek satırlık bir kutu var —
çalışıyor ama tasarlanmadı.

*Ne söylemeli:* Geçmişin ileride **dolacağı** belli olmalı; şu an boş bir
kutu "burada bir şey yok" diyor, "buraya birikecek" demiyor.

*Dokunulacak yer:* `components/butterflies/HistoryCard.tsx` —
`ordered.length === 0` dalı.

---

**D3 — Salma reddedildi: misafir günlük hakkı**

*Ne zaman:* İki ayrı an, ve ikisi ayrı tasarım istiyor:

1. **Kart açılırken zaten dolu** — `blocked` durumu. Bu **hazır**: buton
   `One a day` olup kilitleniyor, altında not var. Yeniden tasarlanmasına
   gerek yok.
2. **Basıldıktan sonra reddedildi** — kullanıcı `Let it go`'ya bastı, sunucu
   IP başına sınıra takıldığını söyledi (başka sekme, aynı ağdaki başka
   kişi). Bu tasarlanmadı: butonun `Letting it go…` durumundan geri dönmesi
   ve reddin **görünür** olması gerekiyor, yoksa hiçbir şey olmamış gibi
   duruyor.

*Ne söylemeli:* Sınırın günlük olduğu ve giriş yapmanın kaldırdığı. Kart
zaten "Sign in to choose the wing colours" bağlantısını taşıyor; ikinci bir
giriş çağrısı koymadan önce ona bak.

*Dokunulacak yer:* `components/release/GuestReleaseCard.tsx`.

---

**D4 — Salma reddedildi: yuvalar dolu**

*Ne zaman:* Üye kanat seçimi kartındayken beşinci yuva doldu (başka sekme)
ya da salma isteği sunucuda tavana takıldı. Kart açılırken dolu olma hâli
zaten çözülü — `goRelease()` kullanıcıyı kanat seçimine hiç sokmuyor,
listeye düşürüyor. Eksik olan **basıldıktan sonra** reddedilme.

*Ne söylemeli:* Kelebek salınmadı, seçilen renkler ve isim **duruyor**.
Kullanıcıyı listeye götüren bir çıkış olmalı (bir yuva boşalınca dönecek).
Karttaki `slotsUsed/5` damgası bu anda güncellenmeli.

*Dokunulacak yer:* `components/release/WingsCard.tsx`.

---

**D5 — Salma başarısız: ağ / sunucu**

*Ne zaman:* İstek hiç ulaşmadı ya da 5xx döndü. D3 ve D4'ten farkı: kural
ihlali yok, **tekrar denenebilir**.

*Ne söylemeli:* "Olmadı, tekrar dene" — sebebi teknik dille anlatma. Tekrar
denemenin **aynı kelebeği** salacağı belli olmalı; taslak (renkler, isim)
kesinlikle kaybolmamalı (§6.4'teki taslak korumasıyla aynı iş).

*Kısıt:* Bu durum iki karta birden giriyor (misafir + üye). Tek bir ortak
parça olarak tasarla — iki ayrı çözüm iki ayrı dil demek.

---

**D6 — Giriş / kayıt hatası**

*Ne zaman:* `Sign in` başarısız. Şu an hiçbir hata yolu yok; kart e-postayı
alıp doğrudan içeri alıyor.

*Ne söylemeli:* ⚠ **Tek mesaj: "email or password is wrong".** Hangi alanın
yanlış olduğu söylenmez — söylenirse e-postanın kayıtlı olup olmadığı ele
verilir ve kullanıcı sayımına izin verilmiş olur. Bu bir tasarım tercihi
değil, güvenlik kuralı.

*Tasarlanacak parçalar:*

- Hatanın kartta durduğu yer (alanların altı / butonun üstü) ve iki alanın
  birden hatalı çerçeve alıp almadığı.
- Ekran okuyucunun duyması: canlı bölge (`aria-live`), odağın nereye gittiği.
- **Kayıt sekmesinin ayrı hâlleri:** şifre en az 10 karakter (şu an yalnızca
  buton kilitli, hata metni yok), e-posta doğrulama bekleniyor.
- Çok deneme sonrası hız sınırı: "too many attempts" bekleme hâli.

*Dokunulacak yer:* `components/account/SignInCard.tsx`.

---

**D7 — Sahne yükleniyor**

*Ne zaman:* İlk açılış. Sahne + three.js ~600 kB ayrı bir parça olarak
iniyor; kartlar hemen görünüyor ama arkadaki çayır boş. Şu an tek yapılan
canvas'ı çayırın ufuk rengiyle (`#e9d3c9`) boyayıp hazır olunca 600ms'de
karşı karşıya geçirmek — yani yavaş bağlantıda kullanıcı düz bir zemine
bakıyor ve bir şey yükleniyor mu bilmiyor.

*Ne söylemeli:* Yükleniyor olduğu, ama kartın önüne geçmeden. Karşılama
metni sahnenin üstünde duruyor; okunabilirliği bozulmamalı.

*Karar gerektiren:* Yer tutucu **statik bir görsel mi** (`meadow-fallback.png`
zaten var, ama 3.5 MB — yükleme sırasında indirmek amacı bozar) yoksa
tokenlardan çizilmiş bir gökyüzü/ufuk gradyanı mı.

*Dokunulacak yer:* `components/meadow/Meadow.tsx` `status === 'loading'`,
`app/styles/screens.css` `.meadow-canvas`.

---

**D8 — Sahne açılamıyor**

*Ne zaman:* WebGL yok ya da `createMeadow()` hata verdi (`status ===
'unsupported'`). Yakalanmış bir çayır karesi gösteriliyor, **hiçbir açıklama
yok** — kullanıcı canlı sahneyi gördüğünü sanıyor.

*Ne söylemeli:* Çayırın bu tarayıcıda canlı çizilemediği. Ürünün geri kalanı
(salma, hesap, liste) çalışmaya devam ediyor; bu bir arıza ekranı değil,
düşülen bir kalite seviyesi.

*Dokunulacak yer:* `components/meadow/Meadow.tsx` `status === 'unsupported'`
dalı.

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
