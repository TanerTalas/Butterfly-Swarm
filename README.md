<div align="center">

# 🦋 Butterfly Swarm

**Yüzlerce kelebek. Tek imleç. İki draw call.**

Three.js ile yazılmış interaktif bir kelebek sürüsü — mouse'u takip ederler,
mouse'dan kaçarlar ya da aldırmazlar. Kanat çırpması GPU'da, uçuş fiziği
noise tabanlı, her kelebek kendi rengi ve boyuyla.

[![Three.js](https://img.shields.io/badge/three.js-r185-000000?style=flat-square&logo=three.js&logoColor=white)](https://threejs.org)
[![Vite](https://img.shields.io/badge/vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
![Draw calls](https://img.shields.io/badge/draw%20calls-2-orange?style=flat-square)
![CPU](https://img.shields.io/badge/500%20kelebek-1.3%20ms%2Fkare-brightgreen?style=flat-square)

<img src="docs/media/swarm.jpg" alt="Butterfly Swarm" width="100%">

</div>

---

## ⚡ Hızlı başlangıç

```bash
npm install
npm run dev          # → http://localhost:5173
```

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Build'i yerelde servis eder |

---

## 🎮 Kullanım

<table>
<tr><td><b>Mouse'u gezdir</b></td><td>Kelebekler takip eder ya da kaçar</td></tr>
<tr><td><b>Hızlı süpür</b></td><td>Sürü hava akımı gibi dalgalanır</td></tr>
<tr><td><b>Sürükle</b></td><td>Kamerayı döndür</td></tr>
<tr><td><b>Tekerlek</b></td><td>Yakınlaş / uzaklaş</td></tr>
</table>

Sağdaki panelden hazır ayarlar — **Sakin**, **Disiplinli Sürü**, **Dağınık**,
**Kaos** — ya da tek tek: kelebek sayısı, boy ve renk çeşitliliği, takip/kaçış
hızları, dağınıklık, kanat formu, kanat deseni, çırpma, sis ve ışık.
Ayarlar tarayıcıya kaydediliyor.

---

## 🔬 Kanat detay laboratuvarı

`/lab.html` — hareketsiz kelebekler yan yana, soldan sağa artan detay.
Her katmanın neye yaradığını izole görmek için.

<img src="docs/media/lab.jpg" alt="Kanat detay laboratuvarı" width="100%">

Sürüdeki desen buradan seçildi: dallanan damarlar + diskal hücre, yönlü pul
dokusu, submarjinal bant, ayrık hilaller, saçak, göz lekesi ve damarlardan
üretilen normal map.

<img src="docs/media/wings.jpg" alt="Kanat detayı yakın plan" width="100%">

---

## 🧠 Nasıl çalışıyor

### Tüm sürü 2 draw call

Gövde + gözler ve 4 kanat, iki birleşik geometriye indiriliyor; ikisi de
`InstancedMesh`. Ajan verisi nesnelerde değil düz `Float32Array`'lerde —
500 ajanın kare başına birkaç vektör ayırması saniyede on binlerce kısa
ömürlü nesne demekti.

### Kanat çırpma vertex shader'da

Instance matrisi konum, yönelim ve ölçek taşıyabiliyor; kanat açısını
taşıyamıyor. Her vertex hangi kanada ait olduğunu, her instance kendi fazını
ve hızını biliyor. Çırpma matematiği `butterfly/flap.js` içinde saf JS,
`swarm/wingShader.js` içinde birebir GLSL karşılığı olarak duruyor.

Vuruş kasıtlı olarak sinüs **değil**: aşağı hamle döngünün %42'si, yukarı
%58'i. Simetrik yapınca animasyon o mekanik "silecek kolu" hissini alıyor.

### Renk çeşitliliği ton döndürmeyle

`InstancedMesh.setColorAt()` diffuse'u **çarpıyor** — turuncu bir deseni
maviyle çarpınca mavi değil koyu çamur çıkıyor, çünkü desenin mavi kanalı
zaten sıfıra yakın. Renk bunun yerine fragment shader'da HSV üzerinden
döndürülüyor: kanadın kendi gradyanı ve koyu kenar bandı korunuyor, tüm renk
çarkı serbest kalıyor.

### Uçuş hacmi = kamera frustum'u

Sabit bir dünya kutusu yerine görünür alan kullanılıyor. Zoom, döndürme ve
pencere boyutu değişimi kendiliğinden hesaba katılıyor; kelebekler her zaman
ekranda kalıyor.

### Dolanma simplex noise ile

Her karede bağımsız rastgele sayı kelebeği titretiyor. Noise'ta yön
değişiminin **kendisi sürekli**, o yüzden yol öngörülemez ama panikli değil.

### Yığılma yerine bulut

Saf "hedefe git" kuvveti sürüyü imlecin üstünde tek topağa çeviriyor. Kuvvet
bunun yerine bir **halkaya** bakıyor ve her kelebek kendi yarıçapını
`cbrt(random)` ile alıyor — yoğunluk hacme eşit dağılıyor, kabuk değil bulut
oluşuyor.

---

## 📊 Performans

| Kelebek | CPU / kare | Üçgen | Draw call |
|--:|--:|--:|--:|
| 120 | 0.95 ms | 152 K | 2 |
| 500 | 1.29 ms | 635 K | 2 |
| 800 | 2.41 ms | 1.02 M | 2 |

16.7 ms kare bütçesine karşı. Küçük ekranlarda kelebek sayısı otomatik
düşüyor, `prefers-reduced-motion` varsa sahne kendiliğinden sakinleşiyor.

---

## 🗂️ Yapı

```
src/
├─ butterfly/     siluetler, gövde, desen, çırpma matematiği
├─ swarm/         InstancedMesh, geometri birleştirme, shader enjeksiyonu
├─ flight/        uçuş kuvvetleri (durumsuz, ayırma yapmaz)
├─ input/         mouse → dünya hedefi
├─ lab/           kanat detay laboratuvarı
└─ ui/            panel, presetler, localStorage
```

---

## 📄 Lisans

[MIT](LICENSE)
