import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = 'plugins/stack-python/skills/building-rag-pipelines/scripts'
const py = (script, args, input) => spawnSync('python3', ['-I', `${base}/${script}`, ...args], { encoding: 'utf8', input })
const dir = mkdtempSync(join(tmpdir(), 'rag-'))

const doc = [
  '# Guide', '',
  'Intro paragraph that is long enough to be a real chunk of text on its own, more than eighty characters.', '',
  '## Install', '',
  '```bash', '# not a heading', 'pip install thing', '```', '',
  '| a | b |', '|---|---|', '| 1 | 2 |', '',
  '## Long', '',
  'word '.repeat(600),
].join('\n')
writeFileSync(join(dir, 'doc.md'), doc)
const lines = (out) => out.trim().split('\n').map((l) => JSON.parse(l))

test('chunk.py is heading-aware, keeps fences whole, and splits long sections with overlap', () => {
  const r = py('chunk.py', [join(dir, 'doc.md'), '--max-chars', '500', '--overlap', '50'])
  assert.equal(r.status, 0, r.stderr)
  const chunks = lines(r.stdout)
  assert.ok(chunks.length >= 5)
  assert.deepEqual(chunks.map((c) => c.chunk_no), chunks.map((_, i) => i))
  assert.ok(chunks.some((c) => c.section === 'Guide > Install' && c.text.includes('# not a heading') && c.text.includes('pip install thing')))
  assert.ok(!chunks.some((c) => c.section === 'not a heading'), 'heading inside a fence must be ignored')
  assert.ok(chunks.filter((c) => c.section === 'Guide > Long').length >= 3)
  for (const c of chunks) {
    assert.ok(c.text.length <= 500, `chunk ${c.chunk_no} is ${c.text.length} chars`)
    assert.match(c.id, /^[0-9a-f]{32}$/)
    assert.match(c.hash, /^[0-9a-f]{16}$/)
  }
  assert.equal(new Set(chunks.map((c) => c.id)).size, chunks.length)
})

test('chunk.py output is deterministic and ids change when the text changes', () => {
  const a = py('chunk.py', [join(dir, 'doc.md')]).stdout
  assert.equal(py('chunk.py', [join(dir, 'doc.md')]).stdout, a)
  const edited = py('chunk.py', ['-', '--source-id', join(dir, 'doc.md')], doc.replace('Intro paragraph', 'Changed paragraph')).stdout
  const [x, y] = [lines(a)[0], lines(edited)[0]]
  assert.notEqual(x.id, y.id)
  assert.notEqual(x.hash, y.hash)
})

test('chunk.py rejects an overlap that is not smaller than the chunk size', () => {
  assert.notEqual(py('chunk.py', [join(dir, 'doc.md'), '--max-chars', '100', '--overlap', '100']).status, 0)
})

const rows = [
  { question: 'q1', relevant_ids: ['a'], retrieved_ids: ['a', 'x', 'y'] },
  { question: 'q2', relevant_ids: ['b', 'c'], retrieved_ids: ['x', 'b', 'y', 'c'] },
  { question: 'q3', relevant_ids: ['d'], retrieved_ids: ['x', 'y', 'z'] },
  { question: 'q4 unanswerable', relevant_ids: [], retrieved_ids: ['x'] },
]
writeFileSync(join(dir, 'ret.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n')

test('eval_retrieval.py computes recall, MRR and nDCG', () => {
  const r = py('eval_retrieval.py', [join(dir, 'ret.jsonl'), '--k', '1,3,5', '--per-question'])
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.equal(out.answerable, 3)
  assert.equal(out.unanswerable, 1)
  assert.equal(out.recall['1'], 0.3333)
  assert.equal(out.recall['3'], 0.5) // (1 + 0.5 + 0) / 3
  assert.equal(out.recall['5'], 0.6667)
  assert.equal(out.mrr, 0.5) // (1 + 1/2 + 0) / 3
  const ndcg2 = (1 / Math.log2(3) + 1 / Math.log2(5)) / (1 + 1 / Math.log2(3)) // q2 at k=5
  assert.equal(out.ndcg['5'], Number(((1 + ndcg2 + 0) / 3).toFixed(4)))
  assert.deepEqual(out.misses.map((m) => m.question), ['q3'])
})

test('eval_retrieval.py gates exit 1 on regression and 2 on malformed input', () => {
  assert.equal(py('eval_retrieval.py', [join(dir, 'ret.jsonl'), '--min-mrr', '0.4']).status, 0)
  const fail = py('eval_retrieval.py', [join(dir, 'ret.jsonl'), '--min-recall', '3=0.9'])
  assert.equal(fail.status, 1)
  assert.match(fail.stdout, /recall@3/)
  writeFileSync(join(dir, 'bad.jsonl'), '{"question": "x"}\n')
  assert.equal(py('eval_retrieval.py', [join(dir, 'bad.jsonl')]).status, 2)
})
