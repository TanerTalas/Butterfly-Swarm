/*
 * Uygulama tipleri.
 *
 * Handoff'un "Data model (minimum)" bölümüyle hizalı. Sunucu gelene kadar
 * aynı şekiller `lib/mock.ts` içinde taklit ediliyor; Aşama C'de yalnızca
 * verinin KAYNAĞI değişecek, şekli değil.
 */

/** Kanat paleti — sahnedeki `WORLD.palette` ile birebir aynı olmalı. */
export const WING_COLOURS = [
  { name: 'turquoise', hex: '#17B3A3' },
  { name: 'blue', hex: '#2F5FD0' },
  { name: 'amber', hex: '#E8A01C' },
  { name: 'purple', hex: '#7A3FC4' },
  { name: 'green', hex: '#2F9E4F' },
] as const;

/** Profil avatarı için altı seçenek (handoff: unisex, all six). */
export const AVATAR_COLOURS = [
  { name: 'blue', hex: '#4F7FBF' },
  { name: 'pink', hex: '#D98AA6' },
  { name: 'turquoise', hex: '#17B3A3' },
  { name: 'amber', hex: '#E8A01C' },
  { name: 'purple', hex: '#7A6BC4' },
  { name: 'green', hex: '#6F8A5A' },
] as const;

/** Kelebek ismi üst sınırı — handoff'ta her sayaç `n/18`. */
export const NAME_MAX = 18;

/** Üyenin aynı anda taşıyabileceği canlı kelebek sayısı. */
export const SLOT_LIMIT = 5;

/*
 * Misafirin GÜNDE salabileceği kelebek sayısı.
 *
 * Üyedeki 5 sınırı "aynı anda kaç tane uçuyor" demek; buradaki ise bir hız
 * sınırı. Misafirin kelebeği takip edilemediği için biriktirmesinin anlamı
 * yok, ama sınırsız salma salma uç noktasını açık bir hedef hâline getiriyor.
 *
 * ⚠ Gerçek uygulama SUNUCUDA, IP başına. Buradaki sayı yalnızca arayüzün
 * doğru şeyi söylemesi için; istemcide tutulan bir sayaç tarayıcı
 * temizlenince sıfırlanır.
 */
export const GUEST_DAILY_LIMIT = 1;

/** Kelebeğin ömrü, gün. */
export const LIFESPAN_DAYS = 7;

export type Butterfly = {
  id: string;
  /** Misafir kelebeklerinde null. */
  name: string | null;
  foreHex: string;
  hindHex: string;
  releasedAt: Date;
};

export type Profile = {
  name: string;
  email: string;
  avatarHex: string;
};

export type Session =
  | { kind: 'guest' }
  | { kind: 'member'; profile: Profile };

/**
 * Kalan gün — SUNUCU otoritesi olacak, bu yalnızca gösterim içindir.
 * İstemci uygunluk hesaplamıyor (handoff: "The client never computes
 * eligibility"); burada yalnızca ilerleme çubuğu çiziliyor.
 */
export function daysLeft(b: Butterfly, now = new Date()): number {
  const elapsed = (now.getTime() - b.releasedAt.getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(LIFESPAN_DAYS - elapsed));
}

export function formatReleased(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
