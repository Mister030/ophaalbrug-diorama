import * as THREE from 'three';
import { box, cyl, sph, tor, rod, group } from './util.js';
import { RIG } from './peopleModel-street.js';
import { contactShadow } from './detail.js';

/**
 * Dutch step-through bicycle ("omafiets"), facing +Z, ground at y 0.
 * The rider rig sits on a measured saddle and its legs are solved to the
 * pedals every frame, so the feet never leave the cranks.
 */
export const BIKE = {
  wheelR: 0.33,
  wheelBase: 1.1,
  bb: new THREE.Vector3(0, 0.34, 0.05),
  crank: 0.16,
  saddle: new THREE.Vector3(0, 0.82, -0.15),
  grip: new THREE.Vector3(0.27, 1.0, 0.2),
  gear: 2.3, // wheel turns per crank turn
};

function wheel(p, M, z) {
  const g = group(p, 0, BIKE.wheelR, z, 'wheel');
  tor(g, BIKE.wheelR - 0.02, 0.028, M.ink, 0, 0, 0, { rot: [0, Math.PI / 2, 0], seg: 24 });
  tor(g, BIKE.wheelR - 0.05, 0.012, M.chrome, 0, 0, 0, { rot: [0, Math.PI / 2, 0], seg: 24 });
  cyl(g, 0.035, 0.035, 0.1, M.chrome, 0, 0, 0, { rot: [0, 0, Math.PI / 2], seg: 8 });
  for (let i = 0; i < 3; i++) box(g, 0.012, (BIKE.wheelR - 0.05) * 2, 0.016, M.chrome, 0, 0, 0, { rot: [(i * Math.PI) / 3, 0, 0], cast: false });
  return g;
}

export function buildBike(M, opts = {}) {
  const frame = opts.frame ?? M.ink;
  const root = new THREE.Group();
  root.name = 'bike';
  const body = group(root, 0, 0, 0, 'bikeBody'); // leans as one piece
  const rear = wheel(body, M, -BIKE.wheelBase / 2);
  const front = group(body, 0, 0, 0, 'steer');
  const fw = wheel(front, M, BIKE.wheelBase / 2);

  const B = BIKE.bb;
  const seat = [0, 0.74, -0.12];
  const headLo = [0, 0.6, 0.4];
  const headHi = [0, 0.86, 0.35];
  const rAx = [0, BIKE.wheelR, -BIKE.wheelBase / 2];
  const fAx = [0, BIKE.wheelR, BIKE.wheelBase / 2];
  const bb = [B.x, B.y, B.z];
  rod(body, bb, seat, 0.03, frame);
  rod(body, headLo, headHi, 0.035, frame);
  // the swooping double down tube of a step-through frame
  for (const dy of [0, 0.09]) {
    rod(body, [0, headLo[1] + dy, headLo[2] - 0.02], [0, 0.38 + dy * 0.6, 0.22], 0.026, frame);
    rod(body, [0, 0.38 + dy * 0.6, 0.22], [bb[0], bb[1] + dy * 0.3, bb[2] + 0.04], 0.026, frame);
  }
  for (const s of [-1, 1]) {
    rod(body, [s * 0.05, bb[1], bb[2]], [s * 0.06, rAx[1], rAx[2]], 0.018, frame);
    rod(body, [s * 0.04, seat[1], seat[2]], [s * 0.06, rAx[1], rAx[2]], 0.018, frame);
  }
  // seat post + sprung leather saddle
  rod(body, seat, [BIKE.saddle.x, BIKE.saddle.y - 0.04, BIKE.saddle.z], 0.016, M.chrome);
  sph(body, 0.1, M.leather ?? M.wood5, BIKE.saddle.x, BIKE.saddle.y - 0.02, BIKE.saddle.z + 0.02, { scale: [0.9, 0.35, 1.4] });
  for (const s of [-1, 1]) tor(body, 0.025, 0.008, M.chrome, s * 0.05, BIKE.saddle.y - 0.08, BIKE.saddle.z - 0.08, { seg: 8 });
  // chain guard (closed case) and kick stand
  box(body, 0.05, 0.14, 0.62, frame, 0.08, (bb[1] + rAx[1]) / 2 + 0.02, (bb[2] + rAx[2]) / 2 + 0.02, { rot: [0.02, 0, 0] });
  rod(body, [0.05, 0.3, -0.2], [0.12, 0.02, -0.38], 0.012, M.steelDark);
  // rear rack and mudguards
  for (const s of [-1, 1]) rod(body, [s * 0.1, 0.7, -0.15], [s * 0.1, 0.7, -0.78], 0.012, M.steelDark);
  box(body, 0.22, 0.02, 0.6, M.steelDark, 0, 0.71, -0.47);
  for (const s of [-1, 1]) rod(body, [s * 0.1, 0.7, -0.78], [s * 0.06, rAx[1], rAx[2]], 0.012, M.steelDark);
  tor(body, BIKE.wheelR + 0.04, 0.03, frame, 0, rAx[1], rAx[2], { rot: [0, Math.PI / 2, 0], arc: Math.PI * 0.8, seg: 16 });
  box(body, 0.06, 0.06, 0.02, M.red, 0, 0.66, -0.8); // rear reflector

  // steering: fork, stem, swept bars, front lamp, optional crate
  front.position.set(0, 0, 0);
  for (const s of [-1, 1]) rod(front, [s * 0.05, headLo[1], headLo[2]], [s * 0.05, fAx[1], fAx[2]], 0.018, frame);
  rod(front, headHi, [0, 1.0, 0.33], 0.02, M.chrome);
  for (const s of [-1, 1]) {
    rod(front, [0, 1.0, 0.33], [s * 0.2, 1.02, 0.3], 0.016, M.chrome);
    rod(front, [s * 0.2, 1.02, 0.3], [s * BIKE.grip.x, BIKE.grip.y, BIKE.grip.z], 0.016, M.chrome);
    box(front, 0.045, 0.045, 0.1, M.ink, s * BIKE.grip.x, BIKE.grip.y, BIKE.grip.z - 0.02);
  }
  tor(front, BIKE.wheelR + 0.04, 0.03, frame, 0, fAx[1], fAx[2], { rot: [0, Math.PI / 2, Math.PI * 0.35], arc: Math.PI * 0.55, seg: 12 });
  box(front, 0.08, 0.08, 0.08, M.cream, 0, 0.72, 0.46);
  if (opts.crate) {
    // front carrier crate with a bunch of tulips: the story of this rider
    box(front, 0.36, 0.03, 0.34, M.steelDark, 0, 0.66, 0.6);
    for (const [w, d, x, z] of [
      [0.38, 0.03, 0, 0.43],
      [0.38, 0.03, 0, 0.77],
      [0.03, 0.36, -0.18, 0.6],
      [0.03, 0.36, 0.18, 0.6],
    ]) box(front, w, 0.22, d, opts.crate, x, 0.78, z);
    for (let i = 0; i < 5; i++) {
      rod(front, [-0.08 + i * 0.04, 0.7, 0.6], [-0.12 + i * 0.06, 1.0, 0.62 + (i % 2) * 0.04], 0.012, M.leaf2);
      sph(front, 0.045, [M.red, M.yellow, M.pink][i % 3], -0.12 + i * 0.06, 1.03, 0.62 + (i % 2) * 0.04, { seg: 6, seg2: 5 });
    }
  }
  if (opts.basket) {
    box(front, 0.3, 0.2, 0.26, opts.basket, 0, 0.88, 0.52);
    box(front, 0.26, 0.04, 0.22, M.ink, 0, 0.97, 0.52);
  }

  // cranks and pedals
  const crank = group(body, 0, B.y, B.z, 'crank');
  const pedals = [];
  for (const s of [-1, 1]) {
    const arm = group(crank, s * 0.1, 0, 0);
    arm.rotation.x = s < 0 ? 0 : Math.PI;
    box(arm, 0.025, BIKE.crank, 0.03, M.chrome, 0, -BIKE.crank / 2, 0);
    const ped = group(arm, s * 0.04, -BIKE.crank, 0);
    box(ped, 0.1, 0.025, 0.07, M.ink, 0, 0, 0);
    pedals.push(ped);
  }
  cyl(crank, 0.07, 0.07, 0.02, M.chrome, 0.07, 0, 0, { rot: [0, 0, Math.PI / 2], seg: 12 });

  // Steer about the head tube, not the bike origin: move the pivot to z 0.4.
  front.position.set(0, 0, 0.4);
  for (const c of front.children) c.position.z -= 0.4;

  const shadow = contactShadow(root, 0, 0, 0, 1.0, 0.55);
  shadow.scale.set(0.45, 1.6, 1);
  return { group: root, body, steer: front, wheels: [rear, fw], crank, pedals, shadow };
}

// ------------------------------------------------------------ rider IK ----

const THIGH = RIG.thigh;
const SHIN = RIG.shin;
const ANKLE_ABOVE_SOLE = 0.045;

/**
 * Two-bone leg IK in the rig's sagittal plane. Hip and target are in the
 * person's root frame (y up, +Z forward). Returns [hipX, kneeX, ankleX].
 * Thigh direction for angle a is (0, -cos a, -sin a), so forward is negative.
 */
export function legIK(hipY, hipZ, ty, tz) {
  const dy = ty - hipY;
  const dz = tz - hipZ;
  let d = Math.hypot(dy, dz);
  d = Math.min(d, THIGH + SHIN - 0.002);
  const phiT = Math.atan2(-dz, -dy);
  const alpha = Math.acos((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d));
  const phi1 = phiT - alpha; // knee forward of the hip–ankle line
  const kz = hipZ - Math.sin(phi1) * THIGH;
  const ky = hipY - Math.cos(phi1) * THIGH;
  const phi2 = Math.atan2(-(tz - kz), -(ty - ky));
  return [phi1, phi2 - phi1, -phi2 * 0.85];
}

/** Rider root offset on the saddle, in the bike frame. */
export const SEAT_ROOT = new THREE.Vector3(0, BIKE.saddle.y - (RIG.hipY - 0.2), BIKE.saddle.z);
export const STAND_ROOT = new THREE.Vector3(0, 0.03, 0.12);

/**
 * Pose for a rider. crankA: crank angle (0 = left pedal down). down: 0 riding,
 * 1 stopped with the left foot on the ground. lean: extra torso pitch.
 * Returns { pose, root } with root in the bike frame.
 */
export function riderPose(crankA, down = 0, lean = 0) {
  const root = SEAT_ROOT.clone().lerp(STAND_ROOT, down);
  const pose = {
    torso: [0.14 + lean, 0, 0],
    head: [-0.1 - lean * 0.6, 0, 0],
    shoulderL: [-0.62, 0, -0.16],
    shoulderR: [-0.62, 0, 0.16],
    elbowL: [-0.42, 0, 0],
    elbowR: [-0.42, 0, 0],
    wristL: [0.2, 0, 0],
    wristR: [0.2, 0, 0],
  };
  const hipY = RIG.hipY;
  for (const [side, phase] of [
    ['L', 0],
    ['R', Math.PI],
  ]) {
    const a = crankA + phase;
    // pedal centre in bike frame -> rider root frame
    const py = BIKE.bb.y - Math.cos(a) * BIKE.crank + ANKLE_ABOVE_SOLE - root.y;
    // crank.rotation.x = a turns the top pedal forward as the bike rolls +Z
    const pz = BIKE.bb.z - Math.sin(a) * BIKE.crank - 0.02 - root.z;
    const [h, k, an] = legIK(hipY, 0, py, pz);
    pose[`hip${side}`] = [h, 0, side === 'L' ? 0.03 : -0.03];
    pose[`knee${side}`] = [k, 0, 0];
    pose[`ankle${side}`] = [an, 0, 0];
  }
  if (down > 0) {
    // left boot planted beside the bike, a little out and forward
    const planted = { hip: [-0.08, 0, 0.17], knee: [0.06, 0, 0], ankle: [0.02, 0, 0] };
    pose.hipL = mix3(pose.hipL, planted.hip, down);
    pose.kneeL = mix3(pose.kneeL, planted.knee, down);
    pose.ankleL = mix3(pose.ankleL, planted.ankle, down);
    pose.torso = mix3(pose.torso, [0.06, 0, 0.05], down);
    // standing over the bars: elbows bend instead of the arms locking straight
    pose.shoulderL = mix3(pose.shoulderL, [-0.45, 0, -0.16], down);
    pose.shoulderR = mix3(pose.shoulderR, [-0.45, 0, 0.16], down);
    pose.elbowL = mix3(pose.elbowL, [-0.8, 0, 0], down);
    pose.elbowR = mix3(pose.elbowR, [-0.8, 0, 0], down);
  }
  return { pose, root };
}

function mix3(a, b, k) {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}
