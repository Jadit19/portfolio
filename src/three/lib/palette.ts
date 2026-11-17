/**
 * The portfolio's pastel palette: one set for every place. Each colour sits in
 * a shared band of lightness and chroma (OKLCH), so any two go together; ink is
 * the one deep tone, for type and tyres. Each place stands on its own ground.
 */

export const PASTEL = {
  // Grounds: very light and soft, one per place.
  linen: "#f0e6da",
  latte: "#f5d4c6",
  peach: "#fcdcc4",
  lilac: "#e4daf8",
  mist: "#cae2f3",
  // Foliage.
  mint: "#8ddfbb",
  pistachio: "#c1dd91",
  fern: "#81bb8d",
  blossom: "#fdb7cb",
  // Earth.
  clay: "#c4917a",
  stone: "#ded6cb",
  cream: "#f9f3e6",
  // Accents.
  coral: "#fa9a87",
  marigold: "#fec766",
  lavender: "#bcabf1",
  aqua: "#79d4e4",
  rose: "#f6a0c1",
  // The one deep tone.
  ink: "#3a2f4d",
} as const;

export type PastelName = keyof typeof PASTEL;

/** Each place's ground (its mood). */
export const GROUND = {
  garage: PASTEL.linen,
  expresso: PASTEL.latte,
  zingle: PASTEL.peach,
  winzo: PASTEL.lilac,
  astro: PASTEL.mist,
} as const;
