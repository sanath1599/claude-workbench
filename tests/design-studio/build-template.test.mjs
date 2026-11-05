import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const assets = new URL('../../plugins/design-studio/skills/previewing-ui-before-building/assets/', import.meta.url).pathname

test('template builds one self-contained html file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'preview-'))
  cpSync(assets, dir, { recursive: true })
  const { build, orderScripts } = await import(pathToFileURL(join(dir, 'build.mjs')).href)
  const r = build('preview.html')
  assert.ok(existsSync(join(dir, 'preview.html')))
  const html = readFileSync(join(dir, 'preview.html'), 'utf8')
  assert.match(html, /--color-brand/)
  assert.match(html, /id="home-empty"/)
  assert.match(html, /window\.DATA/)
  assert.doesNotMatch(html, /\/\*CSS\*\/|<!--SCREENS-->|\/\*JS\*\//)
  assert.deepEqual(orderScripts(['app.js', 'z.js', 'data.js', 'a.js']), ['data.js', 'a.js', 'z.js', 'app.js'])
  assert.equal(r.hasHex, false)
})

test('guided demo skeleton has required controls', () => {
  const s = readFileSync(new URL('../../plugins/design-studio/skills/presenting-guided-demos/assets/skeleton.html', import.meta.url), 'utf8')
  for (const needle of ['1280', 'Slide ', 'overview', 'requestFullscreen', 'location.hash', 'data-step']) assert.ok(s.includes(needle), needle)
})
