/** Independent cosmetics: old saves retain the body's original hair and face. No change to rig/look ids or stats. */
export const HAIR_STYLES = {
  original: { name: 'Original hair', icon: '✂️' },
  short: { name: 'Soft short hair', icon: '👦' },
  bob: { name: 'Round bob', icon: '👩' },
  ponytail: { name: 'Flowing ponytail', icon: '🎀' },
  buns: { name: 'Twin buns', icon: '🍡' },
  waves: { name: 'Long waves', icon: '〰️' },
  rainbow: { name: 'Rainbow fringe', icon: '🌈' },
} as const;
export const FACE_STYLES = {
  original: { name: 'Original face', icon: '🙂' },
  happy: { name: 'Sunny smile', icon: '😄' },
  wink: { name: 'Playful wink', icon: '😉' },
  sparkle: { name: 'Sparkling eyes', icon: '🤩' },
  blush: { name: 'Shy cheeks', icon: '☺️' },
  surprised: { name: 'Little surprise', icon: '😮' },
  tears: { name: 'Teary eyes', icon: '🥹' },
} as const;
export type HairStyle = keyof typeof HAIR_STYLES;
export type FaceStyle = keyof typeof FACE_STYLES;
export interface Appearance { hair: HairStyle; face: FaceStyle }
export const DEFAULT_APPEARANCE: Readonly<Appearance> = { hair: 'original', face: 'original' };
export const isHair = (v: unknown): v is HairStyle => typeof v === 'string' && Object.hasOwn(HAIR_STYLES,v);
export const isFace = (v: unknown): v is FaceStyle => typeof v === 'string' && Object.hasOwn(FACE_STYLES,v);
export function readAppearance(raw: unknown): Appearance {
  const r = raw && typeof raw === 'object' ? raw as Record<string,unknown> : {};
  return { hair: isHair(r.hair) ? r.hair : 'original', face: isFace(r.face) ? r.face : 'original' };
}
export const appearanceOf = (s: { appearance?: Appearance }) => readAppearance(s.appearance);
