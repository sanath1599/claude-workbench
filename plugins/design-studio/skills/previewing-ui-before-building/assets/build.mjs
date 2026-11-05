// Builds preview.html: one self-contained file from src/.
// Usage: node build.mjs [--out preview.html]
//   src/index.html        shell with markers /*CSS*/, <!--SCREENS-->, /*JS*/
//   src/styles.css        design tokens (:root) and components
//   src/screens/*.html    one partial per screen, sorted by file name
//   src/*.js              inlined in name order, data.js first, app.js last
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(join(here, 'src', p), 'utf8')

export function orderScripts(files) {
  const rest = files.filter((f) => f !== 'data.js' && f !== 'app.js').sort()
  return [...files.filter((f) => f === 'data.js'), ...rest, ...files.filter((f) => f === 'app.js')]
}

export function build(outName = 'preview.html') {
  const shell = read('index.html')
  const css = read('styles.css')
  const screensDir = join(here, 'src', 'screens')
  const screens = existsSync(screensDir)
    ? readdirSync(screensDir).filter((f) => f.endsWith('.html')).sort().map((f) => read('screens/' + f)).join('\n')
    : ''
  const scripts = orderScripts(readdirSync(join(here, 'src')).filter((f) => f.endsWith('.js')))
  const js = scripts.map((f) => `/* ${f} */\n${read(f)}`).join('\n').replace(/<\/script/gi, '<\\/script')
  // Function replacers keep "$&" and similar sequences in content literal.
  const html = shell
    .replace('/*CSS*/', () => css)
    .replace('<!--SCREENS-->', () => screens)
    .replace('/*JS*/', () => js)
  writeFileSync(join(here, outName), html)
  return { outName, bytes: Buffer.byteLength(html), scripts, hasHex: /#[0-9a-f]{3,8}\b/i.test(screens) }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--out')
  const r = build(i > 0 ? process.argv[i + 1] : 'preview.html')
  console.log(`Wrote ${r.outName} (${r.bytes} bytes) from ${r.scripts.length} script(s)`)
  if (r.hasHex) console.warn('Warning: hex colour found in a screen partial. Use tokens from styles.css.')
}
