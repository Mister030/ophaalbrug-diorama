import * as THREE from 'three';
import { PALETTE_HEX } from './palette.js';

export const timeUniform = { value: 0 };

const LEGAL = new Set(PALETTE_HEX.map((h) => h.toLowerCase()));

function std(hex, opts = {}) {
  if (!LEGAL.has(hex.toLowerCase())) throw new Error(`material colour ${hex} is not in the palette`);
  const params = {
    color: new THREE.Color(hex),
    roughness: opts.roughness ?? 0.9,
    metalness: opts.metalness ?? 0,
    side: opts.side ?? THREE.FrontSide,
  };
  if (opts.emissive) {
    params.emissive = new THREE.Color(opts.emissive);
    params.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  return new THREE.MeshStandardMaterial(params);
}

/** Every material samples a palette entry; nothing else is allowed in. */
export function createMaterials() {
  const m = {
    paper: std('#ffffff'),
    white: std('#f7f3ea'),
    cream: std('#e9ddc9'),
    plaster: std('#ece5d6'),
    sand: std('#ddd3c1'),
    stoneLight: std('#c9bea9'),

    brick1: std('#c97b57'),
    brick2: std('#b0603f'),
    brick3: std('#96503a'),
    brick4: std('#7c4232'),
    brickDark: std('#64362b'),
    brickLight: std('#e0a07c'),
    quayBrick: std('#7c4232'),
    soot: std('#4d2b25'),

    stone: std('#a9a9a2'),
    kerb: std('#8f9089'),
    asphalt: std('#61655f'),
    cobble: std('#777a74'),
    slate: std('#4c504c'),
    slateDark: std('#383c3a'),
    ink: std('#252826'),

    canalWall: std('#4d2b25'),
    canalFloor: std('#2f4a46'),

    leaf1: std('#86a653'),
    leaf2: std('#688a42'),
    leaf3: std('#4f6f35'),
    leafLight: std('#a7c06a'),
    bark: std('#4a3620'),

    red: std('#d64b3c'),
    redDark: std('#a8352b'),
    orange: std('#e8893a'),
    yellow: std('#f0c64a'),
    blue: std('#4f7fb8'),
    navy: std('#2f4566'),
    teal: std('#3f9a96'),
    pink: std('#e48aa0'),
    purple: std('#7a5a9a'),
    denim: std('#5d7fa0'),
    olive: std('#7d7a4a'),
    black: std('#1d1d1f'),

    wood1: std('#d9b98a'),
    wood2: std('#b8925e'),
    wood3: std('#94703f'),
    wood4: std('#6e512d'),
    wood5: std('#4a3620'),

    glass: std('#4f6d7c', { roughness: 0.25 }),
    glassLight: std('#8fb0c0', { roughness: 0.3 }),
    glassPale: std('#b9d2dd', { roughness: 0.3 }),
    steel: std('#777a74', { roughness: 0.5, metalness: 0.3 }),
    steelDark: std('#383c3a', { roughness: 0.55, metalness: 0.2 }),
    chrome: std('#c9bea9', { roughness: 0.35, metalness: 0.4 }),

    lampOn: std('#fff0c8', { emissive: '#ffd27a', emissiveIntensity: 1.4 }),
    redLamp: std('#d64b3c', { emissive: '#d64b3c', emissiveIntensity: 1.6 }),
    redLampOff: std('#64362b'),
    beer: std('#f0c64a', { roughness: 0.3 }),
    foam: std('#fff0c8'),
  };

  // People: the street rig reads these keys.
  m.skinTones = ['#f4d5b8', '#e3b48f', '#d0966b', '#b07a52', '#8c5a3a', '#63402a'].map((h) => std(h, { roughness: 0.8 }));
  m.hair = ['#2c231e', '#5c4030', '#c9a46a', '#ece5d6'].map((h) => std(h));
  m.cloth = {
    navy: m.navy,
    charcoal: m.slate,
    coral: m.red,
    rust: m.orange,
    rose: m.pink,
    tealDeep: m.teal,
    denim: m.denim,
    olive: m.olive,
    cream: m.cream,
    white: m.white,
    black: m.black,
    yellow: m.yellow,
    purple: m.purple,
    blue: m.blue,
  };
  m.leather = m.wood5;
  m.eye = m.ink;
  m.mouth = m.brickDark;
  m.bone = m.white;
  return m;
}
