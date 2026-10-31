import { chromium } from 'playwright-core';

/**
 * Freeze at t, print the numbers that matter (rider distances, actor world
 * positions, tiller/hand contact) and save one screenshot, optionally through
 * a debug camera.
 *
 *   node qa/probe.mjs 20.7                       hero camera
 *   node qa/probe.mjs 4.3 "-2,3,0.5:-5.8,0.8,-4.2" shots/terrace.png
 */
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = process.env.BASE_URL || 'http://127.0.0.1:4180/index.html';
const t = parseFloat(process.argv[2] ?? '0');
const view = process.argv[3] || '';
const out = process.argv[4] || `shots/probe-${t}.png`;
const quiet = process.env.QUIET === '1';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto(`${url}?t=${t}`);
await page.waitForFunction(() => window.__dioramaReady, null, { timeout: 20000 });

const info = await page.evaluate(
  ({ t, view }) => {
    const d = window.__diorama;
    d.freeze(t);
    if (view) {
      const [p, q] = view.split(':').map((s) => s.split(',').map(Number));
      d.view(p, q);
      d.freeze(t);
    }
    const r3 = (n) => +n.toFixed(2);
    const pos = (o) => {
      const v = new d.THREE.Vector3();
      o.getWorldPosition(v);
      return [r3(v.x), r3(v.y), r3(v.z)];
    };
    const riders = {};
    for (const [id, rd] of Object.entries(d.cast.riders)) {
      riders[id] = { vis: rd.bike.group.visible, d: r3(rd.dist(t)), len: r3(rd.track.length), pos: pos(rd.bike.group) };
    }
    const sk = d.cast.skipper;
    return {
      stops: d.stops,
      lift: r3(d.sched.lift(t)),
      boom: r3(d.sched.boom(t)),
      bow: r3(d.sched.bow(t)),
      riders,
      keeper: pos(d.cast.keeper.group),
      walker: { vis: d.cast.walker.group.visible, pos: pos(d.cast.walker.group) },
      waiter: { vis: d.cast.waiter.group.visible, pos: pos(d.cast.waiter.group) },
      guests: d.cast.guests.map((g) => pos(g.p.group)),
      skipperWristR: pos(sk.joints.wristR),
      tillerEnd: (() => {
        const v = new d.THREE.Vector3(0.95, 0.38, 0.32);
        d.boat.steer.tiller.localToWorld(v);
        return [r3(v.x), r3(v.y), r3(v.z)];
      })(),
      rods: d.bridge.rods.map((r) => ({ pos: pos(r), len: r3(r.scale.y), up: r3(new d.THREE.Vector3(0, 1, 0).applyQuaternion(r.quaternion).y) })),
      cam: [r3(d.camera.position.x), r3(d.camera.position.y), r3(d.camera.position.z)],
    };
  },
  { t, view }
);
if (!quiet) console.log(JSON.stringify(info));
await page.screenshot({ path: out });
console.log(`t=${t} errors=${errors.length ? JSON.stringify(errors) : 'none'} -> ${out}`);
await browser.close();
