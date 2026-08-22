import { sessionClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

/*
 * Oturumun sunucudaki tek okuma noktası.
 *
 * ⚠ `getUser()` kullanılıyor, `getSession()` DEĞİL. `getSession()` çerezdeki
 * JWT'yi olduğu gibi çözüp döndürüyor — imzasını Supabase'e doğrulatmıyor,
 * yani uydurulmuş bir çerez ona geçerli görünür. `getUser()` her seferinde
 * Auth sunucusuna soruyor. Bir ağ gidiş dönüşü pahalı ama burası yetkinin
 * karar verildiği yer.
 */

export type SessionState =
  /** Giriş yapılmamış. Çayır yine de görünüyor — misafir de kelebek salabiliyor. */
  | { kind: 'guest' }
  /**
   * Kayıt tamamlanmış ama hesap kurulumu YAPILMAMIŞ: `profiles.name` NULL.
   *
   * Ayrı bir hâl olması şart. Arayüz bu kullanıcıyı `setup` ekranına
   * götürmek zorunda; üye gibi davranılsaydı isimsiz bir profille çayıra
   * girer ve kelebeğinin yanında boş bir isim görünürdü.
   */
  | { kind: 'incomplete'; userId: string; email: string }
  | { kind: 'member'; userId: string; profile: Profile };

/**
 * Çerezdeki oturumu okur ve profili getirir.
 *
 * Server Component'ten de Server Action'dan da çağrılabilir. Hiçbir şey
 * fırlatmıyor: oturum yoksa ya da profil satırı okunamıyorsa `guest` dönüyor —
 * çayır kimliksiz de çalışan bir yer, giriş yapılamaması sayfayı çökertmemeli.
 */
export async function readSession(): Promise<SessionState> {
  const supabase = await sessionClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { kind: 'guest' };

  const user = data.user;

  /*
   * Profil `sessionClient` ile okunuyor, servis anahtarıyla değil: RLS
   * uygulansın ve "yalnızca kendi satırın" politikası burada da geçerli
   * olsun. Servis anahtarıyla okumak çalışırdı ama yetki kontrolünü tek
   * kaynaktan (politikadan) almaktan vazgeçmek olurdu.
   */
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, avatar_hex')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.name || !profile.avatar_hex) {
    return { kind: 'incomplete', userId: user.id, email: user.email ?? '' };
  }

  return {
    kind: 'member',
    userId: user.id,
    profile: {
      name: profile.name,
      email: user.email ?? '',
      avatarHex: profile.avatar_hex,
    },
  };
}
