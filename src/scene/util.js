import * as THREE from 'three';

/** Small mesh helpers. Every mesh casts and receives unless told otherwise. */
function finish(m, parent, x, y, z, o) {
  m.position.set(x, y, z);
  if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
  if (o.scale) m.scale.set(o.scale[0], o.scale[1], o.scale[2]);
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.receive ?? true;
  if (o.name) m.name = o.name;
  parent.add(m);
  return m;
}

export const box = (p, w, h, d, mat, x, y, z, o = {}) =>
  finish(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), p, x, y, z, o);

export const cyl = (p, rt, rb, h, mat, x, y, z, o = {}) =>
  finish(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 14, 1, o.open ?? false, o.t0 ?? 0, o.tl ?? Math.PI * 2), mat), p, x, y, z, o);

export const sph = (p, r, mat, x, y, z, o = {}) =>
  finish(new THREE.Mesh(new THREE.SphereGeometry(r, o.seg ?? 14, o.seg2 ?? 10), mat), p, x, y, z, o);

export const ico = (p, r, mat, x, y, z, o = {}) =>
  finish(new THREE.Mesh(new THREE.IcosahedronGeometry(r, o.detail ?? 1), mat), p, x, y, z, o);

export const tor = (p, r, tube, mat, x, y, z, o = {}) =>
  finish(new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, o.seg ?? 20, o.arc ?? Math.PI * 2), mat), p, x, y, z, o);

/** A rod between two points (for frames, stays, rods, tubes). */
export function rod(p, a, b, r, mat, o = {}) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r1 ?? r, r, len, o.seg ?? 8), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  m.castShadow = o.cast ?? true;
  m.receiveShadow = true;
  p.add(m);
  return m;
}

/** Extrude a 2D outline (XY) by `depth` along +Z, centred on depth. */
export function extrude(p, pts, depth, mat, x, y, z, o = {}) {
  const shape = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: o.bevel ?? false,
    bevelThickness: o.bevel ?? 0,
    bevelSize: o.bevel ?? 0,
    bevelSegments: 1,
    curveSegments: o.curve ?? 10,
  });
  geo.translate(0, 0, -depth / 2);
  return finish(new THREE.Mesh(geo, mat), p, x, y, z, o);
}

export function group(parent, x = 0, y = 0, z = 0, name) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (name) g.name = name;
  parent.add(g);
  return g;
}
