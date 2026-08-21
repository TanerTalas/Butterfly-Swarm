import { Garden } from '@/components/Garden';

/*
 * Tek sayfa. Yasal sayfalar dışında her şey `Garden` içinde yaşıyor.
 *
 * Sayaç ilerideki aşamada sunucudan gelecek (`counters` tablosu, Redis'te
 * önbellekli); şimdilik sıfırdan başlıyor.
 */
export default function Home() {
  /*
   * Sayaç 27'den başlıyor.
   *
   * Tohum SAHTE ve bilinçli: bomboş bir sayaç, çayırı "kimsenin uğramadığı
   * bir yer" gibi gösteriyor. Üstüne eklenen her +1 GERÇEK — salınan her
   * kelebek sayacı bir artırıyor ve o artışların hiçbiri uydurma değil.
   *
   * ⚠ Sunucu geldiğinde bu sayı SUNUCUDA durmalı, burada değil: istemcide
   * kaldığı sürece her sekme kendi 27'sinden başlıyor ve sayaç küresel bir
   * toplam olmaktan çıkıyor.
   */
  return <Garden initialTotal={27} />;
}
