import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';

/**
 * Render a shot list to PNG frames for a vertical (9:16) video.
 *
 *   node qa/record.mjs video/shots.json video/frames
 *
 * Each shot: { name, t0, t1, speed, cam: [pos, target], camEnd?: [pos, target] }
 * Frames are rendered at W x H through the debug camera (`view`), frozen per
 * frame, so the capture is deterministic and never depends on frame timing.
 * The page's frame is stretched to the full viewport first so the canvas is
 * exactly W x H.
 */
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = process.env.BASE_URL || 'http://127.0.0.1:4182/index.html';
const W = Number(process.env.W || 1080);
const H = Number(process.env.H || 1920);
const FPS = Number(process.env.FPS || 30);
const list = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3] || 'video/frames';
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.error('pageerror', String(e)));
await page.goto(`${url}?t=0`);
await page.waitForFunction(() => window.__dioramaReady, null, { timeout: 20000 });
await page.addStyleTag({ content: '#frame{width:100vw!important;height:100vh!important;}' });
await page.evaluate(() => window.dispatchEvent(new Event('resize')));
await page.waitForTimeout(300);

const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);

for (const shot of list) {
  if (only && !only.includes(shot.name)) continue;
  const dir = `${out}/${shot.name}`;
  mkdirSync(dir, { recursive: true });
  const dur = (shot.t1 - shot.t0) / (shot.speed ?? 1);
  const n = Math.max(1, Math.round(dur * FPS));
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const file = `${dir}/f${String(i).padStart(4, '0')}.png`;
    if (existsSync(file) && !process.env.FORCE) continue;
    const k = n > 1 ? i / (n - 1) : 0;
    const t = shot.t0 + (i / FPS) * (shot.speed ?? 1);
    const a = shot.cam;
    const b = shot.camEnd ?? shot.cam;
    const e = ease(k);
    const cam = {
      pos: a[0].map((v, j) => lerp(v, b[0][j], e)),
      target: a[1].map((v, j) => lerp(v, b[1][j], e)),
    };
    await page.evaluate(
      ({ t, cam }) => {
        const d = window.__diorama;
        d.view(cam.pos, cam.target);
        d.freeze(t);
      },
      { t, cam }
    );
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: W, height: H } });
  }
  console.log(`${shot.name}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
await browser.close();
