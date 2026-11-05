import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = 'plugins/docs-and-data/skills'
const py = (script, args) => spawnSync('python3', [`${base}/${script}`, ...args], { encoding: 'utf8' })

// Build minimal OOXML fixtures with the Python standard library so no packages are needed.
const dir = mkdtempSync(join(tmpdir(), 'dd-'))
const make = spawnSync('python3', ['-c', `
import zipfile, sys
d = sys.argv[1]
def z(name, files):
    with zipfile.ZipFile(f"{d}/{name}", "w") as f:
        for k, v in files.items(): f.writestr(k, v)
W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
z("good.docx", {"word/document.xml": f'<w:document {W}><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Scope</w:t></w:r></w:p><w:p><w:r><w:t>Text</w:t></w:r></w:p><w:p><w:fldSimple w:instr="PAGE"/></w:p></w:body></w:document>'})
z("bad.docx", {"word/document.xml": f'<w:document {W}><w:body><w:p><w:r><w:t>TODO write this</w:t></w:r></w:p><w:p><w:r><w:t>Page 3</w:t></w:r></w:p></w:body></w:document>'})
S = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
wb = f'<workbook {S}><sheets><sheet name="Calc" sheetId="1" r:id="rId1"/></sheets></workbook>'
rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'
def sheet(cells): return f'<worksheet {S}><sheetData><row r="1">{cells}</row></sheetData></worksheet>'
z("good.xlsx", {"xl/workbook.xml": wb, "xl/_rels/workbook.xml.rels": rels, "xl/worksheets/sheet1.xml": sheet('<c r="A1"><v>2</v></c><c r="B1"><f>A1*2</f><v>4</v></c>')})
z("bad.xlsx", {"xl/workbook.xml": wb, "xl/_rels/workbook.xml.rels": rels, "xl/worksheets/sheet1.xml": sheet('<c r="A1"><f>Ghost!A1</f></c><c r="B1" t="e"><f>1/0</f><v>#DIV/0!</v></c>')})
P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
def slide(title, body): return f'<p:sld {P}><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="1" name="T"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>{title}</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="2" name="B"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:txBody><a:p><a:r><a:t>{body}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
z("good.pptx", {"ppt/slides/slide1.xml": slide("Costs fell 12 percent", "three short words")})
z("bad.pptx", {"ppt/slides/slide1.xml": slide("", "word " * 120)})
open(f"{d}/t.csv", "w").write("id,amount,note\\n1,10,a\\n2,20,a\\n2,20,a\\n3,,\\n")
`, dir], { encoding: 'utf8' })
assert.equal(make.status, 0, make.stderr)

test('inspect_docx passes a clean file and flags placeholders and typed page numbers', () => {
  assert.equal(py('producing-word-documents/scripts/inspect_docx.py', [join(dir, 'good.docx')]).status, 0)
  const bad = py('producing-word-documents/scripts/inspect_docx.py', [join(dir, 'bad.docx')])
  assert.equal(bad.status, 1)
  assert.match(bad.stdout, /placeholder/)
  assert.match(bad.stdout, /typed into the body/)
})

test('check_xlsx accepts cached formulas and flags errors and missing sheets', () => {
  assert.equal(py('producing-spreadsheets/scripts/check_xlsx.py', [join(dir, 'good.xlsx')]).status, 0)
  const bad = py('producing-spreadsheets/scripts/check_xlsx.py', [join(dir, 'bad.xlsx')])
  assert.equal(bad.status, 1)
  assert.match(bad.stdout, /missing sheet 'Ghost'/)
  assert.match(bad.stdout, /#DIV\/0!/)
  assert.match(bad.stdout, /no cached value/)
})

test('inspect_pptx flags empty titles and heavy slides', () => {
  assert.equal(py('producing-slide-decks/scripts/inspect_pptx.py', [join(dir, 'good.pptx')]).status, 0)
  const bad = py('producing-slide-decks/scripts/inspect_pptx.py', [join(dir, 'bad.pptx')])
  assert.equal(bad.status, 1)
  assert.match(bad.stdout, /no title/)
  assert.match(bad.stdout, /words \(limit 90\)/)
})

test('profile_table reports blanks, duplicates and ranges', () => {
  const r = py('analysing-tabular-data/scripts/profile_table.py', [join(dir, 't.csv'), '--json'])
  assert.equal(r.status, 0, r.stderr)
  const j = JSON.parse(r.stdout)
  assert.equal(j.rows, 4)
  assert.equal(j.columns[1].blank, 1)
  assert.deepEqual([j.columns[1].min, j.columns[1].max], [10, 20])
  assert.ok(j.notes.some((n) => /duplicate/.test(n)))
})

test('scripts print usage without arguments', () => {
  for (const s of ['producing-word-documents/scripts/inspect_docx.py', 'producing-spreadsheets/scripts/check_xlsx.py', 'producing-slide-decks/scripts/inspect_pptx.py', 'working-with-pdfs/scripts/pdf_probe.py', 'analysing-tabular-data/scripts/profile_table.py']) {
    const r = py(s, [])
    assert.equal(r.status, 2, s)
    assert.match(r.stderr, /Usage/)
  }
})
