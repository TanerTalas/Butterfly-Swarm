# Butterfly Swarm

Three.js ile yüzlerce kelebeğin mouse'u takip ettiği ya da mouse'dan kaçtığı
interaktif bir sahne. Davranış, görünüm ve uçuş fiziği panelden canlı
ayarlanabiliyor.

## Çalıştırma

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build (dist/)
npm run preview   # build'i yerelde servis et
```

## Sayfalar

| Sayfa | Ne |
|---|---|
| `/` | Sürü — asıl sahne |
| `/lab.html` | Kanat detay laboratuvarı: hareketsiz kelebekler, desen denemeleri yan yana |

## Kullanım

Mouse'u gezdir — kelebekler takip eder ya da kaçar (panelden seçilir).
Sürükle: kamerayı döndür · tekerlek: yakınlaş.
Mouse'u hızlı süpürünce sürü hava akımı gibi dalgalanır.

Panelde hazır ayarlar (`Disiplinli Sürü`, `Dağınık`, `Kaos`, `Sakin`) ve
kelebek sayısı, boy/renk çeşitliliği, takip ve kaçış hızları, dağınıklık,
kanat formu, kanat deseni, çırpma ve sahne başlıkları var. Ayarlar
`localStorage`'a kaydediliyor.

## Nasıl çalışıyor

**Tüm sürü 2 draw call.** Gövde + gözler ve 4 kanat iki birleşik geometriye
indiriliyor, ikisi de `InstancedMesh`. Ajan verisi nesnelerde değil düz
`Float32Array`'lerde tutuluyor.

**Kanat çırpma vertex shader'da.** Instance matrisi konum, yönelim ve ölçek
taşıyabiliyor ama kanat açısını taşıyamıyor; her vertex hangi kanada ait
olduğunu, her instance kendi fazını ve hızını biliyor. Çırpma matematiği
`butterfly/flap.js` içinde saf JS, `swarm/wingShader.js` içinde birebir GLSL
karşılığı olarak duruyor.

**Renk çeşitliliği ton döndürmeyle.** `setColorAt()` diffuse'u çarptığı için
turuncu bir deseni maviyle çarpmak koyu çamur veriyordu; renk fragment
shader'da HSV üzerinden döndürülüyor, böylece kanadın kendi gradyanı ve koyu
kenar bandı korunurken tüm renk çarkı kullanılabiliyor.

**Uçuş hacmi kamera frustum'u.** Sabit bir dünya kutusu yerine görünür alan
kullanılıyor; zoom, döndürme ve pencere boyutu değişimi kendiliğinden hesaba
katılıyor.

**Dolanma simplex noise ile.** Her karede bağımsız rastgele sayı kelebeği
titretiyor; noise'ta yön değişiminin kendisi sürekli.

Performans: 500 kelebek ~1.3 ms CPU/kare, 635 K üçgen, 2 draw call.

## Lisans

[MIT](LICENSE)
