// Screenshots a page at several widths and writes shots + summary.json.
// Usage: node shoot.mjs <url-or-file> [--out dir] [--widths 375,768,1280,1536] [--full]
// Needs Playwright (npm i -D playwright; npx playwright install chromium). Exit 2 if unavailable.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

export const DEFAULT_WIDTHS = [375, 768, 1280, 1536]

export function parseArgs(argv) {
  const o = { target: null, out: 'ui-shots', widths: DEFAULT_WIDTHS, full: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') o.out = argv[++i]
    else if (a === '--widths') o.widths = argv[++i].split(',').map(Number).filter((n) => n > 0)
    else if (a === '--full') o.full = true
    else if (!a.startsWith('--') && !o.target) o.target = a
  }
  return o
}

export function toUrl(target) {
  return /^[a-z]+:\/\//i.test(target) ? target : pathToFileURL(resolve(target)).href
}

export function summarize(results) {
  const problems = []
  for (const r of results) {
    if (r.overflowX) problems.push(`${r.width}px: horizontal overflow (${r.scrollWidth} > ${r.width})`)
    if (r.consoleErrors.length) problems.push(`${r.width}px: ${r.consoleErrors.length} console error(s)`)
    if (r.clipped.length) problems.push(`${r.width}px: ${r.clipped.length} element(s) with clipped text`)
    if (r.smallTargets.length) problems.push(`${r.width}px: ${r.smallTargets.length} tap target(s) under 44px`)
  }
  return { ok: problems.length === 0, problems }
}

// Runs inside the page.
function inspect() {
  const clipped = [], smallTargets = []
  const sel = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList[0] ? '.' + el.classList[0] : '')
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && /(hidden|clip)/.test(cs.overflowX) && el.textContent.trim()) clipped.push(sel(el))
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) clipped.push(sel(el))
    if (el.matches('a[href],button,input,[role=button]')) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && (r.width < 44 || r.height < 44) && r.bottom > 0) smallTargets.push(sel(el))
    }
  }
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clipped: [...new Set(clipped)].slice(0, 20),
    smallTargets: [...new Set(smallTargets)].slice(0, 20),
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (!opts.target) {
    console.error('Usage: node shoot.mjs <url-or-file> [--out dir] [--widths 375,768,1280,1536] [--full]')
    process.exit(1)
  }
  let pw
  try {
    pw = await import('playwright')
  } catch {
    console.error('Playwright is not installed here. Install it (npm i -D playwright && npx playwright install chromium) or use the chrome-devtools MCP tools: resize_page, take_screenshot, list_console_messages.')
    process.exit(2)
  }
  mkdirSync(opts.out, { recursive: true })
  const browser = await pw.chromium.launch()
  const results = []
  for (const width of opts.widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const consoleErrors = []
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
    page.on('pageerror', (e) => consoleErrors.push(String(e)))
    await page.goto(toUrl(opts.target), { waitUntil: 'networkidle' })
    const info = await page.evaluate(inspect)
    const file = join(opts.out, `w${width}.png`)
    await page.screenshot({ path: file, fullPage: opts.full })
    results.push({ width, file, overflowX: info.scrollWidth > width, ...info, consoleErrors })
    await page.close()
  }
  await browser.close()
  const summary = { target: opts.target, ...summarize(results), results }
  writeFileSync(join(opts.out, 'summary.json'), JSON.stringify(summary, null, 2))
  console.log(summary.ok ? 'OK: no problems found' : 'Problems:\n- ' + summary.problems.join('\n- '))
  console.log(`Wrote ${results.length} screenshots and summary.json to ${opts.out}`)
  process.exit(summary.ok ? 0 : 1)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
