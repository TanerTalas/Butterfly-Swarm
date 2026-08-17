import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// İki sayfa: sürü (index) ve kanat detay laboratuvarı (lab).
// Dev sunucusu kök dizindeki her HTML'i zaten servis ediyor; bu giriş listesi
// production build'in ikisini de üretmesi için gerekli.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        lab: resolve(import.meta.dirname, 'lab.html'),
      },
    },
  },
});
