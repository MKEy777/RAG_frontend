import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { stripIncompleteRefTag, refsToPlaceholders, placeholdersToSup } from './citation'

marked.setOptions({ gfm: true, breaks: true, async: false })

export function renderMarkdown(text: string): string {
  const html = marked.parse(text) as string
  return DOMPurify.sanitize(html)
}

export function renderChatMarkdown(text: string): string {
  const prepared = refsToPlaceholders(stripIncompleteRefTag(text))
  const html = marked.parse(prepared) as string
  return DOMPurify.sanitize(placeholdersToSup(html), { ADD_ATTR: ['data-ref-id'] })
}

const WIKI_LINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function renderWikiMarkdown(text: string): string {
  const prepared = text.replace(WIKI_LINK_RE, (_m, slug: string, name?: string) => {
    const s = escapeHtml(slug.trim())
    return `<a class="wiki-link" data-wiki-slug="${s}">${escapeHtml((name || slug).trim())}</a>`
  })
  const html = marked.parse(prepared) as string
  return DOMPurify.sanitize(html, { ADD_ATTR: ['data-wiki-slug'] })
}
