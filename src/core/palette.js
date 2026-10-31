/**
 * 64-colour palette for an Amsterdam canal on a bright afternoon. Keep the
 * length at exactly 64: the post shader declares vec3[64].
 */
export const PALETTE_HEX = [
  // paper, white paint, plaster (5)
  '#ffffff', '#f7f3ea', '#ece5d6', '#ddd3c1', '#c9bea9',
  // brick ramp (8)
  '#e0a07c', '#c97b57', '#b0603f', '#96503a', '#7c4232', '#64362b', '#4d2b25', '#3a221f',
  // stone, asphalt, roof slate (7)
  '#a9a9a2', '#8f9089', '#777a74', '#61655f', '#4c504c', '#383c3a', '#252826',
  // canal water + foam (6)
  '#6f8f7f', '#5d7d70', '#4c6b61', '#3d5a53', '#2f4a46', '#a9c4b4',
  // leaves (6)
  '#a7c06a', '#86a653', '#688a42', '#4f6f35', '#3a5429', '#c7d68f',
  // skin (6)
  '#f4d5b8', '#e3b48f', '#d0966b', '#b07a52', '#8c5a3a', '#63402a',
  // hair (3)
  '#2c231e', '#5c4030', '#c9a46a',
  // cloth and paint accents (12)
  '#d64b3c', '#a8352b', '#e8893a', '#f0c64a', '#4f7fb8', '#2f4566',
  '#3f9a96', '#e48aa0', '#7a5a9a', '#5d7fa0', '#7d7a4a', '#1d1d1f',
  // wood (5)
  '#d9b98a', '#b8925e', '#94703f', '#6e512d', '#4a3620',
  // glass (3)
  '#b9d2dd', '#8fb0c0', '#4f6d7c',
  // warm light, cream (3)
  '#ffd27a', '#fff0c8', '#e9ddc9',
];

if (PALETTE_HEX.length !== 64) throw new Error(`palette has ${PALETTE_HEX.length} entries, shader expects 64`);

export const PALETTE_RGB = PALETTE_HEX.map((hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
});
