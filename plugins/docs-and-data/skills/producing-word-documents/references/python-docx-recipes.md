# python-docx recipes

python-docx has no API for fields, so these use the underlying XML through `docx.oxml`. Each recipe is a function to paste into the build script.

## Field helper (PAGE, NUMPAGES, TOC)

```python
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def add_field(paragraph, instruction, placeholder="1"):
    run = paragraph.add_run()
    for kind, text in (("begin", None), (None, instruction), ("separate", None), (None, placeholder), ("end", None)):
        if kind:
            el = OxmlElement("w:fldChar")
            el.set(qn("w:fldCharType"), kind)
        elif text == instruction:
            el = OxmlElement("w:instrText")
            el.set(qn("xml:space"), "preserve")
            el.text = text
        else:
            el = OxmlElement("w:t")
            el.text = text
        run._r.append(el)
    return run
```

Use it as `add_field(p, "PAGE")`, `add_field(p, "NUMPAGES")` and `add_field(p, 'TOC \\o "1-3" \\h \\z \\u', "Right-click to update the table of contents")`. The placeholder text is what shows until Word updates the field.

## Ask Word to refresh fields on open

```python
settings = doc.settings.element
el = OxmlElement("w:updateFields")
el.set(qn("w:val"), "true")
settings.append(el)
```

Word then asks the reader to update fields when the file opens. That is expected; tell the owner.

## Footer with "Page X of Y"

```python
p = doc.sections[0].footer.paragraphs[0]
p.text = "Page "
add_field(p, "PAGE")
p.add_run(" of ")
add_field(p, "NUMPAGES")
```

For a cover page with no number, set `section.different_first_page_header_footer = True` and leave the first-page footer empty.

## Repeat the header row of a table across pages

```python
tr_pr = table.rows[0]._tr.get_or_add_trPr()
el = OxmlElement("w:tblHeader")
el.set(qn("w:val"), "true")
tr_pr.append(el)
```

Also set `table.autofit = False` and give every cell in a column the same width, because Word ignores column width on the column object alone.

## Styles once, not per paragraph

```python
from docx.shared import Pt, RGBColor
st = doc.styles["Normal"]; st.font.name = "Calibri"; st.font.size = Pt(11)
st.paragraph_format.space_after = Pt(6)
h1 = doc.styles["Heading 1"]; h1.font.size = Pt(18); h1.font.color.rgb = RGBColor(0x1F, 0x3A, 0x5F)
h1.paragraph_format.keep_with_next = True
```

Set the East Asian font too when the text is not Latin: `st.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")`.

## New section with another orientation

```python
from docx.enum.section import WD_SECTION, WD_ORIENT
s = doc.add_section(WD_SECTION.NEW_PAGE)
s.orientation = WD_ORIENT.LANDSCAPE
s.page_width, s.page_height = s.page_height, s.page_width
```

## Alt text on a picture

```python
pic = doc.add_picture("logo.png", width=Inches(1.5))
pic._inline.docPr.set("descr", "Company logo")
```
