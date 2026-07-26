const REF_TAG_RE = /<ref\s+id="(c\d+)"\s*\/?>/g
const PLACEHOLDER_RE = /@@REF:(c\d+)@@/g

// 流式撕裂：裁掉末尾未闭合的 <ref 前缀
export function stripIncompleteRefTag(text: string): string {
  const lt = text.lastIndexOf('<')
  if (lt === -1) return text
  const tail = text.slice(lt)
  if (tail.includes('>')) return text
  if (/^<(r(e(f(\s[^>]*)?)?)?)?$/.test(tail)) return text.slice(0, lt)
  return text
}

export function refsToPlaceholders(text: string): string {
  return text.replace(REF_TAG_RE, (_, id) => `@@REF:${id}@@`)
}

export function placeholdersToSup(html: string): string {
  return html.replace(PLACEHOLDER_RE, (_, id: string) => {
    const n = id.slice(1)
    return `<sup class="citation" data-ref-id="${id}">${n}</sup>`
  })
}
