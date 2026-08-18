import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Üç sayfa: sürü (index), kanat detay laboratuvarı (lab) ve sakura çayırı
// (world — Aşama A, sahne geliştirme). Dev sunucusu kök dizindeki her HTML'i
// zaten servis ediyor; bu giriş listesi production build'in üçünü de üretmesi
// için gerekli.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        lab: resolve(import.meta.dirname, 'lab.html'),
        world: resolve(import.meta.dirname, 'world.html'),
      },
    },
  },
});
