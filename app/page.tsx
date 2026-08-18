import { Garden } from '@/components/Garden';

/*
 * Tek sayfa. Yasal sayfalar dışında her şey `Garden` içinde yaşıyor.
 *
 * Sayaç ilerideki aşamada sunucudan gelecek (`counters` tablosu, Redis'te
 * önbellekli); şimdilik sıfırdan başlıyor.
 */
export default function Home() {
  return <Garden initialTotal={0} />;
}
