// 사용 설명서 Markdown → Word(.docx) 변환
// 사용법: node scripts/md-to-docx.mjs
import { marked } from 'marked'
import htmlToDocx from 'html-to-docx'
import { readFileSync, writeFileSync } from 'fs'

const FILES = [
  { md: 'docs/운영자_사용설명서.md', docx: 'docs/운영자_사용설명서.docx' },
  { md: 'docs/직원_사용설명서.md',   docx: 'docs/직원_사용설명서.docx' },
]

const CSS = `
  body { font-family: '맑은 고딕','Malgun Gothic',sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; }
  h1 { font-size: 20pt; color: #1d4ed8; border-bottom: 2px solid #1d4ed8; padding-bottom: 6px; }
  h2 { font-size: 15pt; color: #1e3a8a; margin-top: 20px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
  h3 { font-size: 12.5pt; color: #334155; margin-top: 14px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 9px; font-size: 10.5pt; text-align: left; }
  th { background: #eff6ff; font-weight: bold; }
  code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-family: Consolas,monospace; }
  blockquote { border-left: 3px solid #93c5fd; margin: 8px 0; padding: 4px 12px; color: #475569; background: #f8fafc; }
  ul, ol { margin: 6px 0; padding-left: 22px; }
  li { margin: 3px 0; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
  strong { color: #0f172a; }
`

for (const { md, docx } of FILES) {
  const markdown = readFileSync(md, 'utf8')
  const inner = marked.parse(markdown)
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${inner}</body></html>`
  const buffer = await htmlToDocx(html, null, {
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false,
    font: 'Malgun Gothic',
    fontSize: 22, // half-points (11pt)
  })
  writeFileSync(docx, buffer)
  console.log('생성:', docx, `(${Math.round(buffer.length / 1024)}KB)`)
}
console.log('완료')
