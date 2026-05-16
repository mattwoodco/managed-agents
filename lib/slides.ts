import { promises as fs } from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'

export type SlideVariant = 'title' | 'section' | 'content'

export type Slide = {
  order: number
  variant: SlideVariant
  topic?: string
  title: string
  html: string
}

type Frontmatter = {
  order: number
  variant: SlideVariant
  topic?: string
  title: string
}

const SLIDES_DIR = path.join(process.cwd(), 'content', 'slides')

const TWO_COL_MARKER = '<!-- col -->'

function applyHighlight(html: string): string {
  return html.replace(/==(.+?)==/g, '<mark class="highlight">$1</mark>')
}

function applyTwoCol(html: string): string {
  if (!html.includes(TWO_COL_MARKER)) return html
  const parts = html.split(TWO_COL_MARKER)
  if (parts.length !== 2) return html.replaceAll(TWO_COL_MARKER, '')
  const [left, right] = parts
  return `<div class="two-col"><div class="col">${left.trim()}</div><div class="col">${right.trim()}</div></div>`
}

async function renderMarkdown(body: string): Promise<string> {
  const file = await remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).process(body)
  let html = String(file)
  html = applyHighlight(html)
  html = applyTwoCol(html)
  return html
}

function isFrontmatter(data: Record<string, unknown>): data is Frontmatter {
  return (
    typeof data.order === 'number' &&
    typeof data.variant === 'string' &&
    typeof data.title === 'string' &&
    (data.variant === 'title' || data.variant === 'section' || data.variant === 'content')
  )
}

export async function getSlides(): Promise<Slide[]> {
  const entries = await fs.readdir(SLIDES_DIR)
  const files = entries.filter((f) => f.endsWith('.md'))
  const slides = await Promise.all(
    files.map(async (file) => {
      const raw = await fs.readFile(path.join(SLIDES_DIR, file), 'utf8')
      const parsed = matter(raw)
      if (!isFrontmatter(parsed.data)) {
        throw new Error(`Invalid frontmatter in ${file}`)
      }
      const fm = parsed.data
      const html = await renderMarkdown(parsed.content)
      const slide: Slide = {
        order: fm.order,
        variant: fm.variant,
        topic: fm.topic,
        title: fm.title,
        html,
      }
      return slide
    }),
  )
  return slides.sort((a, b) => a.order - b.order)
}
