/*
 * Davranış presetleri.
 *
 * Yalnızca uçuş/davranış parametrelerine dokunuyorlar; kelebek tasarımı
 * (kanat formu, renk, boy) preset'ten etkilenmiyor — kullanıcının üzerinde
 * uğraştığı görünüm bir preset tıklamasıyla sıfırlanmasın.
 */

export const PRESETS = {
  'Disiplinli Sürü': {
    scatter: 0.12,
    wander: 2.2,
    turnRate: 11,
    maxSpeed: 2.0,
    maxForce: 6,
    followSpeed: 5.5,
    followSpread: 0.3,
    orbitSpeed: 5,
    bank: 0.55,
  },
  Dağınık: {
    scatter: 0.55,
    wander: 4.5,
    turnRate: 8,
    maxSpeed: 1.8,
    maxForce: 5,
    followSpeed: 4.2,
    followSpread: 0.7,
    orbitSpeed: 4,
    bank: 0.5,
  },
  Kaos: {
    scatter: 1.0,
    wander: 10,
    turnRate: 5,
    maxSpeed: 3.4,
    maxForce: 14,
    followSpeed: 2.5,
    followSpread: 1.0,
    orbitSpeed: 9,
    bank: 0.85,
  },
};

export function applyPreset(flight, name) {
  const preset = PRESETS[name];
  if (preset) Object.assign(flight, preset);
}
