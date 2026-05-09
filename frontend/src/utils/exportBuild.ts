import type { PageNode } from '../types/pageTree'

type BuildFiles = {
  html: string
  css: string
  js: string
}

const INDENT = '  '

function toKebab(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase()
}

function classNameFor(node: PageNode): string {
  return `node-${toKebab(node.id)}`
}

function styleToCssBlock(node: PageNode): string {
  const lines = Object.entries(node.styles ?? {})
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `  ${toKebab(key)}: ${String(value)};`)
  if (lines.length === 0) return ''
  return `.${classNameFor(node)} {\n${lines.join('\n')}\n}`
}

function renderNodeHtml(node: PageNode, depth = 2): string {
  const pad = INDENT.repeat(depth)
  const cls = classNameFor(node)
  const childrenHtml = node.children.map((child) => renderNodeHtml(child, depth + 1)).join('\n')

  switch (node.type) {
    case 'Page':
      return `${pad}<main class="${cls}">\n${childrenHtml}\n${pad}</main>`
    case 'Section':
      return `${pad}<section class="${cls}">\n${childrenHtml}\n${pad}</section>`
    case 'Container':
      return `${pad}<div class="${cls}">\n${childrenHtml}\n${pad}</div>`
    case 'Columns':
      return `${pad}<div class="${cls}">\n${childrenHtml}\n${pad}</div>`
    case 'Divider':
      return `${pad}<hr class="${cls}" />`
    case 'Navbar':
      return `${pad}<nav class="${cls}">\n${childrenHtml}\n${pad}</nav>`
    case 'Footer':
      return `${pad}<footer class="${cls}">\n${childrenHtml}\n${pad}</footer>`
    case 'Span':
      return `${pad}<span class="${cls}">${String(node.props.text ?? '')}</span>`
    case 'Heading': {
      const level =
        typeof node.meta?.headingLevel === 'number' && node.meta.headingLevel >= 1 && node.meta.headingLevel <= 6
          ? node.meta.headingLevel
          : 2
      return `${pad}<h${level} class="${cls}">${childrenHtml || String(node.props.text ?? '')}</h${level}>`
    }
    case 'Text':
      return `${pad}<p class="${cls}">${childrenHtml || String(node.props.text ?? '')}</p>`
    case 'Image':
      return `${pad}<img class="${cls}" src="${String(node.meta?.src ?? node.props.src ?? '')}" alt="${String(node.meta?.alt ?? node.props.alt ?? '')}" />`
    case 'Button':
      return `${pad}<a class="${cls}" href="${String(node.meta?.href ?? node.props.href ?? '#')}">${childrenHtml || String(node.props.label ?? '')}</a>`
    case 'Input':
      return `${pad}<input class="${cls}" type="${String(node.props.type ?? 'text')}" placeholder="${String(node.props.placeholder ?? '')}" value="${String(node.props.value ?? '')}" />`
    case 'TextField':
      return `${pad}<input class="${cls}" type="text" placeholder="${String(node.props.placeholder ?? '')}" value="${String(node.props.value ?? '')}" />`
    case 'TextArea':
      return `${pad}<textarea class="${cls}" rows="${Math.max(2, Number(node.props.rows ?? 4))}" placeholder="${String(node.props.placeholder ?? '')}">${String(node.props.value ?? '')}</textarea>`
    case 'Select':
      return `${pad}<select class="${cls}">\n${childrenHtml}\n${pad}</select>`
    case 'Option':
      return `${pad}<option class="${cls}" value="${String(node.props.value ?? '')}">${String(node.props.label ?? node.props.text ?? '')}</option>`
    case 'Checkbox':
      return `${pad}<label class="${cls}"><input type="checkbox" ${node.props.checked ? 'checked' : ''} /> ${childrenHtml || String(node.props.label ?? '')}</label>`
    case 'Radio':
      return `${pad}<label class="${cls}"><input type="radio" name="${String(node.props.name ?? '')}" ${node.props.checked ? 'checked' : ''} /> ${childrenHtml || String(node.props.label ?? '')}</label>`
    case 'Label':
      return `${pad}<label class="${cls}">${childrenHtml}</label>`
    case 'Form':
      return `${pad}<form class="${cls}">\n${childrenHtml}\n${pad}</form>`
    default:
      return `${pad}<div class="${cls}" data-type="${node.type}">\n${childrenHtml}\n${pad}</div>`
  }
}

function collectCss(node: PageNode, out: string[] = []): string[] {
  const block = styleToCssBlock(node)
  if (block) out.push(block)
  node.children.forEach((child) => collectCss(child, out))
  return out
}

function downloadFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function buildFilesFromTree(tree: PageNode): BuildFiles {
  const htmlBody = renderNodeHtml(tree, 2)
  const cssBlocks = collectCss(tree).join('\n\n')

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${String(tree.props.title ?? 'Exported Page')}</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
${htmlBody}
  <script src="./script.js"></script>
</body>
</html>
`

  const css = `/* Generated by Sketch Me */\n\n${cssBlocks}\n`

  const js = `// Generated by Sketch Me
document.querySelectorAll('form').forEach((form) => {
  form.addEventListener('submit', (e) => {
    e.preventDefault()
  })
})
`

  return { html, css, js }
}

export function exportBuildFromTree(tree: PageNode) {
  const files = buildFilesFromTree(tree)
  downloadFile('index.html', files.html, 'text/html;charset=utf-8')
  downloadFile('styles.css', files.css, 'text/css;charset=utf-8')
  downloadFile('script.js', files.js, 'text/javascript;charset=utf-8')
}

export function buildPreviewDocumentFromTree(tree: PageNode): string {
  const files = buildFilesFromTree(tree)
  return files.html
    .replace(
      '<link rel="stylesheet" href="./styles.css" />',
      `<style>\n${files.css}\n</style>`,
    )
    .replace(
      '<script src="./script.js"></script>',
      `<script>\n${files.js}\n</script>`,
    )
}
