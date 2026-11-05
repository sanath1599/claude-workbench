import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadData, contrast, filterEntries, renderTokensCss, run, parseArgs } from '../../plugins/design-studio/skills/choosing-type-and-color/scripts/search.mjs'

const script = fileURLToPath(new URL('../../plugins/design-studio/skills/choosing-type-and-color/scripts/search.mjs', import.meta.url))
const { palettes, fonts } = loadData()
const HEX = /^#[0-9A-F]{6}$/

test('datasets have 20 to 30 entries with unique ids and tags', () => {
  for (const set of [palettes, fonts]) {
    assert.ok(set.length >= 20 && set.length <= 30, `size ${set.length}`)
    assert.equal(new Set(set.map((e) => e.id)).size, set.length)
    for (const e of set) for (const k of ['mood', 'industries', 'use']) assert.ok(Array.isArray(e[k]) && e[k].length > 0, `${e.id}.${k}`)
  }
})

test('palette colours are valid hex and the stored contrast matches the computed one', () => {
  for (const p of palettes) {
    for (const mode of p.modes) for (const v of Object.values(p[mode])) assert.match(v, HEX, p.id)
    assert.equal(p.contrast.fgOnBg, contrast(p.light.fg, p.light.bg), `${p.id} fgOnBg`)
    assert.equal(p.contrast.onPrimaryOnPrimary, contrast(p.light.onPrimary, p.light.primary), `${p.id} onPrimary`)
    assert.equal(p.contrast.accentOnBg, contrast(p.light.accent, p.light.bg), `${p.id} accent`)
  }
})

test('every palette meets the text contrast floors in each mode it ships', () => {
  for (const p of palettes) {
    for (const mode of p.modes) {
      const t = p[mode]
      assert.ok(contrast(t.fg, t.bg) >= 7, `${p.id} ${mode} fg`)
      assert.ok(contrast(t.muted, t.bg) >= 4.5 && contrast(t.muted, t.surface) >= 4.5, `${p.id} ${mode} muted`)
      assert.ok(contrast(t.onPrimary, t.primary) >= 4.5, `${p.id} ${mode} button label`)
      for (const k of ['accent', 'success', 'warning', 'danger']) assert.ok(contrast(t[k], t.bg) >= 4.5 && contrast(t[k], t.surface) >= 4.5, `${p.id} ${mode} ${k}`)
      if (!p.primaryIsFillOnly) assert.ok(contrast(t.primary, t.bg) >= 3, `${p.id} ${mode} primary on page`)
    }
    for (const c of p.chart.light) assert.ok(contrast(c, p.light.bg) >= 3, `${p.id} chart ${c}`)
    assert.equal(p.chart.light.length, 5)
  }
})

test('font entries name real fontsource packages and a Google Fonts URL', () => {
  for (const f of fonts) {
    assert.ok(f.fontsource.length > 0 && f.fontsource.every((n) => n.startsWith('@fontsource')), f.id)
    assert.match(f.googleFontsUrl, /^https:\/\/fonts\.googleapis\.com\/css2\?family=/)
    assert.ok(f.body.stack.includes(f.body.family))
  }
})

test('filterEntries matches by industry, mood, tags and text', () => {
  const hr = filterEntries(palettes, { industry: 'hr' })
  assert.ok(hr.some((p) => p.id === 'pine-people'))
  assert.ok(hr.every((p) => p.industries.includes('hr')))
  assert.ok(filterEntries(fonts, { mood: 'accessible' }).some((f) => f.id === 'atkinson-access'))
  assert.ok(filterEntries(palettes, { tags: 'dashboard,b2b' }).every((p) => p.use.includes('dashboard') || p.use.includes('b2b')))
  assert.deepEqual(filterEntries(palettes, { industry: 'no-such-industry' }), [])
  assert.ok(filterEntries(palettes, { mode: 'dark' }).every((p) => p.modes.includes('dark')))
  assert.ok(filterEntries(palettes, { text: 'olive' }).length >= 1)
})

test('renderTokensCss emits semantic tokens, fonts, and an optional dark block', () => {
  const p = palettes.find((x) => x.id === 'cobalt-ledger')
  const f = fonts.find((x) => x.id === 'inter-solo')
  const css = renderTokensCss(p, f, { withDark: true })
  for (const needle of ['--color-primary:', '--color-on-primary:', '--font-body:', '--chart-5:', '--space-4:', '[data-theme="dark"]', 'prefers-reduced-motion']) assert.ok(css.includes(needle), needle)
  assert.ok(!renderTokensCss(p, f).includes('[data-theme="dark"]'))
  assert.ok(renderTokensCss(p, null).includes('--font-display:'))
})

test('run: export writes a file; unknown ids and modes fail', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tokens-'))
  const out = join(dir, 'nested', 'tokens.css')
  const logs = []
  assert.equal(run(['export', 'pine-people', '--font', 'jakarta-solo', '--out', out], { out: (m) => logs.push(m), err: (m) => logs.push(m) }), 0)
  assert.ok(existsSync(out))
  assert.match(readFileSync(out, 'utf8'), /--p-primary: #134E4A;/)
  const errs = []
  assert.equal(run(['export', 'nope'], { out: () => {}, err: (m) => errs.push(m) }), 1)
  assert.equal(run(['export', 'pine-people', '--mode', 'dark'], { out: () => {}, err: (m) => errs.push(m) }), 1)
  assert.equal(run(['export', 'pine-people', '--font', 'nope'], { out: () => {}, err: (m) => errs.push(m) }), 1)
  assert.equal(errs.length, 3)
})

test('parseArgs separates flags from positionals', () => {
  const a = parseArgs(['palettes', '--tags', 'a,b', '--json'])
  assert.deepEqual(a._, ['palettes'])
  assert.equal(a.tags, 'a,b')
  assert.equal(a.json, true)
})

test('CLI prints matches, JSON, contrast and usage', () => {
  const ok = spawnSync(process.execPath, [script, 'palettes', '--industry', 'fintech'], { encoding: 'utf8' })
  assert.equal(ok.status, 0)
  assert.match(ok.stdout, /cobalt-ledger/)
  const js = spawnSync(process.execPath, [script, 'fonts', '--mood', 'minimal', '--json'], { encoding: 'utf8' })
  assert.ok(Array.isArray(JSON.parse(js.stdout)))
  const c = spawnSync(process.execPath, [script, 'contrast', '#000000', '#FFFFFF'], { encoding: 'utf8' })
  assert.match(c.stdout, /^21:1/)
  const none = spawnSync(process.execPath, [script], { encoding: 'utf8' })
  assert.equal(none.status, 1)
  assert.match(none.stderr, /Usage/)
})
