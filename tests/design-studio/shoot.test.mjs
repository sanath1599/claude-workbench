import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseArgs, toUrl, summarize, DEFAULT_WIDTHS } from '../../plugins/design-studio/skills/verifying-ui-in-browser/scripts/shoot.mjs'

const script = fileURLToPath(new URL('../../plugins/design-studio/skills/verifying-ui-in-browser/scripts/shoot.mjs', import.meta.url))

test('parseArgs defaults and overrides', () => {
  assert.deepEqual(parseArgs(['a.html']).widths, DEFAULT_WIDTHS)
  const o = parseArgs(['http://x', '--out', 'o', '--widths', '320,640', '--full'])
  assert.deepEqual(o, { target: 'http://x', out: 'o', widths: [320, 640], full: true })
})

test('toUrl keeps urls and converts paths', () => {
  assert.equal(toUrl('https://a.b/c'), 'https://a.b/c')
  assert.match(toUrl('x.html'), /^file:\/\/.*x\.html$/)
})

test('summarize flags problems', () => {
  const ok = { width: 375, overflowX: false, scrollWidth: 375, consoleErrors: [], clipped: [], smallTargets: [] }
  assert.equal(summarize([ok]).ok, true)
  const bad = { ...ok, overflowX: true, scrollWidth: 500, consoleErrors: ['boom'] }
  const s = summarize([bad])
  assert.equal(s.ok, false)
  assert.equal(s.problems.length, 2)
})

test('CLI without target exits 1 with usage', () => {
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /Usage/)
})
