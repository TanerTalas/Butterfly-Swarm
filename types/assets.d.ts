/*
 * CSS yan etki importları için bildirim.
 *
 * Next normalde bunu kendi tip tanımlarıyla sağlıyor ama TypeScript 6 ile
 * `import './globals.css'` satırı TS2882 veriyor. Bildirim burada açıkça
 * duruyor; sahne motorunun `.js` modülleri de `allowJs` ile geliyor,
 * onlar için ek bir şey gerekmiyor.
 */
declare module '*.css';
