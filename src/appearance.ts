/** Cosmetic choices retain their saved ids; short/bob are legacy aliases of the replacement hairstyles. */
export const HAIR_STYLES = {
  original: { name: 'Snow fox layers', icon: '✂️' },
  short: { name: 'Snow fox layers', icon: '👦' },
  bob: { name: 'Moonlit fox layers', icon: '👩' },
  ponytail: { name: 'Midnight pumpkin tails', icon: '🎀' },
  buns: { name: 'Blue braided buns', icon: '🍡' },
  waves: { name: 'Moonlit fox layers', icon: '〰️' },
  rainbow: { name: 'Rainbow swept hair', icon: '🌈' },
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
