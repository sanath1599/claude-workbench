// Manual end-to-end check of the /workbench:new studio in a real browser (not part of npm test).
//   PLAYWRIGHT_FROM=/path/to/project/package.json node tests/e2e/studio-flow.mjs <studio.mjs> <fixtures dir> <work dir>
// The fixtures dir holds choices.json, sample.html and plan.md (see tests/e2e/fixtures).
import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
// Needs Playwright: set PLAYWRIGHT_FROM to any project that has it installed (a package.json path).
const require = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url);
const { chromium } = require('playwright');
const [ST, S, W] = process.argv.slice(2);
mkdirSync(W, { recursive: true });
const D = `${W}/.ws`;
const cli = (...a) => execFileSync('node', [ST, ...a, '--dir', D], { encoding: 'utf8' }).trim();
const srv = spawn('node', [ST, 'start', '--dir', D, '--no-open'], { stdio: ['ignore', 'pipe', 'inherit'] });
const url = await new Promise((res) => srv.stdout.on('data', (b) => { const m = /STUDIO_URL=(\S+)/.exec(String(b)); if (m) res(m[1]); }));
let last = 0;
const waitReply = () => { const line = cli('wait', '--after', String(last), '--timeout', '20'); const e = JSON.parse(line); last = e.id; return e; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: 'domcontentloaded' });
const shot = (n) => page.screenshot({ path: `${W}/${n}.png` });
const step = async (label) => { await page.waitForTimeout(700); };
// 1 questions, then a status message before answering
cli('push', '--kind', 'questions', '--file', new URL('../../plugins/workbench/skills/new/assets/intake.json', import.meta.url).pathname, '--title', 'Project intake');
await step(); cli('push', '--kind', 'message', '--text', 'Reading your brief and drafting design directions', '--title', 'Working');
await step(); await shot('a-intake-with-message');
await page.getByRole('button', { name: /^Submit$/ }).click();
const e1 = waitReply(); console.log('reply 1:', e1.kind, Object.keys(e1.data || {}).length, 'answers');
// 2 choices
cli('push', '--kind', 'choices', '--file', `${S}/choices.json`, '--title', 'Design direction');
await step(); await shot('b-choices');
await page.locator('[role=radio], input[type=radio]').nth(1).click({ force: true });
await page.getByRole('button', { name: /send|submit|confirm|choose/i }).last().click();
const e2 = waitReply(); console.log('reply 2:', e2.kind, JSON.stringify(e2.data).slice(0, 120));
// 3 mock: request changes, then approve a second version
cli('push', '--kind', 'mock', '--file', `${S}/sample.html`, '--title', 'Sample v1', '--screens', 'Today,Detail');
await step(); await page.waitForTimeout(600); await shot('c-mock');
const ta = page.locator('textarea').last(); await ta.fill('Make the call button secondary');
await page.getByRole('button', { name: /request changes/i }).last().click();
const e3 = waitReply(); console.log('reply 3:', e3.kind, JSON.stringify(e3.data).slice(0, 140));
cli('push', '--kind', 'mock', '--file', `${S}/sample.html`, '--title', 'Sample v2', '--screens', 'Today,Detail');
await step(); await page.getByRole('button', { name: /approve/i }).last().click();
const e4 = waitReply(); console.log('reply 4:', e4.kind, JSON.stringify(e4.data).slice(0, 100));
// 4 plan
cli('push', '--kind', 'plan', '--file', `${S}/plan.md`, '--title', 'Plan');
await step(); await shot('d-plan');
await page.getByRole('button', { name: /approve/i }).last().click();
const e5 = waitReply(); console.log('reply 5:', e5.kind, JSON.stringify(e5.data).slice(0, 100));
cli('push', '--kind', 'done', '--title', 'Ready to build');
await step(); await shot('e-done');
console.log('export:', cli('export', '--to', `${W}/intake`));
console.log('files:', ['answers.json', 'choices.json', 'approval.json'].map((f) => `${f}=${existsSync(`${W}/intake/${f}`)}`).join(' '));
console.log('raw tokens left in outbox:', (readFileSync(`${D}/outbox.jsonl`, 'utf8').match(/\{\{wb\./g) || []).length);
console.log('page errors:', JSON.stringify(errors));
await browser.close(); cli('stop'); srv.kill();
