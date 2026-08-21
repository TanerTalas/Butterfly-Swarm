import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

/*
 * Supabase istemcileri — İKİSİ DE YALNIZCA SUNUCUDA.
 *
 * ⚠ TARAYICI SUPABASE İLE HİÇ KONUŞMUYOR ve konuşmamalı. Sebebi oturum
 * çerezi: `@supabase/ssr` çerezi kim yazıyorsa onun yetkisiyle yazıyor, ve
 * tarayıcıdan yazılan bir çerez `httpOnly` OLAMAZ — JavaScript'in eriştiği bir
 * token, XSS'in de eriştiği bir token demek. Bütün okuma ve yazma Server
 * Action içinden geçtiği için anon anahtar bile istemciye inmiyor; bu yüzden
 * hiçbir değişken `NEXT_PUBLIC_` değil.
 *
 * Bunun bedeli: Supabase'in istemci tarafı kolaylıkları (realtime abonelik,
 * doğrudan sorgu) kullanılamıyor. Karşılığında token hiç DOM'a girmiyor ve
 * kontenjan sayımı gibi kuralların tamamı tek yerde kalıyor.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} tanımlı değil. .env.example'ı .env.local'a kopyalayıp Supabase ` +
        'proje anahtarlarını doldur.',
    );
  }
  return value;
}

/**
 * Giriş yapmış kullanıcının yetkisiyle çalışan istemci.
 *
 * Anon anahtarı + oturum çerezini kullanıyor, yani RLS UYGULANIYOR: bu
 * istemciyle yapılan bir sorgu politikaların izin verdiğinden fazlasını
 * göremiyor. Kullanıcının kendi verisini okumanın varsayılan yolu bu.
 *
 * ⚠ Çerez YAZMAK yalnızca Server Action ve Route Handler içinde mümkün.
 * Server Component'ten çağrıldığında `setAll` sessizce düşüyor — token
 * yenileme o istekte olmuyor, bir sonrakinde oluyor. Bilinçli: alternatif,
 * her sayfa render'ında çerez yazmaya çalışıp Next'in fırlattığı hatayı
 * yutmak olurdu.
 */
export async function sessionClient() {
  const store = await cookies();

  return createServerClient(
    required('SUPABASE_URL'),
    required('SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) {
              store.set(name, value, {
                ...options,
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
              });
            }
          } catch {
            // Server Component: çerez yazılamaz, yenileme sonraki isteğe kalır.
          }
        },
      },
    },
  );
}

/**
 * Servis anahtarıyla çalışan istemci — RLS'i ATLAR.
 *
 * ⚠ Yalnızca kuralın kendisi politikayla ifade edilemediğinde. Bugün tek
 * müşterisi salma: kontenjan sayımı ile eklemenin aynı işlemde olması
 * gerekiyor (iki sekme aynı anda salarsa tavan aşılmasın) ve bunu bir RLS
 * politikası anlatamıyor.
 *
 * Kullanıcının kendi verisini okumak için BUNU KULLANMA — `sessionClient()`
 * kullan. Buradaki istemci "kimin adına" sorduğunu bilmiyor; yetki kontrolünü
 * unutmak sessizce başkasının kelebeğini döndürmek demek.
 */
export function adminClient() {
  return createClient(
    required('SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
