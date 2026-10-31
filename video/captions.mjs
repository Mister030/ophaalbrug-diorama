import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';

/** Render each shot's caption to a transparent 1080x1920 PNG for ffmpeg's overlay. */
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const shots = JSON.parse(readFileSync('video/shots.json', 'utf8'));
mkdirSync('video/captions', { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

for (const s of shots) {
  const [head, sub] = s.text.split('|');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:1080px;height:1920px;background:transparent;font-family:-apple-system,"SF Pro Display","Helvetica Neue",Arial,sans-serif;}
    .wrap{position:absolute;left:0;right:0;top:230px;display:flex;flex-direction:column;align-items:center;gap:18px;padding:0 70px;}
    .line{display:inline-block;background:rgba(10,10,12,.72);color:#fff;border-radius:22px;padding:18px 34px;text-align:center;
          letter-spacing:-0.01em;line-height:1.15;box-shadow:0 8px 30px rgba(0,0,0,.25);}
    .head{font-size:78px;font-weight:800;}
    .sub{font-size:58px;font-weight:600;color:#ffe9b8;}
    .tag{position:absolute;left:0;right:0;bottom:560px;text-align:center;font-size:40px;font-weight:700;color:#fff;
         text-shadow:0 2px 14px rgba(0,0,0,.6);letter-spacing:.02em;}
  </style></head><body>
    <div class="wrap"><div class="line head">${head}</div>${sub ? `<div class="line sub">${sub}</div>` : ''}</div>
    <div class="tag">#threejs &nbsp;#pixelart &nbsp;#aiagents</div>
  </body></html>`;
  await page.setContent(html);
  await page.screenshot({ path: `video/captions/${s.name}.png`, omitBackground: true });
  console.log('caption', s.name);
}
await browser.close();
