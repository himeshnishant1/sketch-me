import type { PageNode } from '../types/pageTree'
import JSZip from 'jszip'

type BuildFiles = {
  html: string
  css: string
  js: string
}

type ReactExportFile = {
  filename: string
  content: string
  mime?: string
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

function attrsForNode(node: PageNode): string {
  const attrs = [`class="${classNameFor(node)}"`]
  if (node.meta?.role) {
    attrs.push(`data-meta-role="${escapeHtml(String(node.meta.role))}"`)
  }
  return attrs.join(' ')
}

function styleToCssBlock(className: string, styles: Record<string, unknown> | undefined): string {
  const lines = Object.entries(styles ?? {})
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `  ${toKebab(key)}: ${String(value)};`)
  if (lines.length === 0) return ''
  return `.${className} {\n${lines.join('\n')}\n}`
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeJsString(input: string): string {
  return input.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
}

function parseSubMenu(raw: unknown): Array<{ label: string; href: string }> {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is { label: unknown; href: unknown } => !!item && typeof item === 'object')
      .map((item) => ({
        label: String(item.label ?? ''),
        href: String(item.href ?? '#'),
      }))
      .filter((item) => item.label.trim().length > 0)
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      return parseSubMenu(parsed)
    } catch {
      return []
    }
  }
  return []
}

function isTrue(value: unknown): boolean {
  return value === true || String(value).toLowerCase() === 'true'
}

function renderButton(node: PageNode, className: string, childrenHtml: string, pad: string): string {
  const href = escapeHtml(String(node.meta?.href ?? node.props.href ?? '#'))
  const label = childrenHtml || escapeHtml(String(node.props.label ?? ''))
  if (!isTrue(node.props.navLink)) {
    return `${pad}<a class="${className}" href="${href}">${label}</a>`
  }
  const subMenu = parseSubMenu(node.props.subMenu)
  const submenuHtml =
    subMenu.length === 0
      ? ''
      : `\n${pad}  <ul class="nav-submenu">\n${subMenu
          .map(
            (item) =>
              `${pad}    <li><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a></li>`,
          )
          .join('\n')}\n${pad}  </ul>`
  return `${pad}<div class="${className} nav-item"><a class="nav-link" href="${href}">${label}</a>${submenuHtml}\n${pad}</div>`
}

function renderNodeHtml(node: PageNode, depth = 2): string {
  const pad = INDENT.repeat(depth)
  const cls = classNameFor(node)
  const attrs = attrsForNode(node)
  const childrenHtml = node.children.map((child) => renderNodeHtml(child, depth + 1)).join('\n')

  switch (node.type) {
    case 'Page':
      return `${pad}<main ${attrs}>\n${childrenHtml}\n${pad}</main>`
    case 'Section':
      return `${pad}<section ${attrs}>\n${childrenHtml}\n${pad}</section>`
    case 'Container':
      return `${pad}<div ${attrs}>\n${childrenHtml}\n${pad}</div>`
    case 'Columns':
      return `${pad}<div ${attrs}>\n${childrenHtml}\n${pad}</div>`
    case 'Divider':
      return `${pad}<hr ${attrs} />`
    case 'Navbar':
      return `${pad}<nav ${attrs} data-navbar="true" class="${cls} nav-shell">\n${childrenHtml}\n${pad}</nav>`
    case 'Footer':
      return `${pad}<footer ${attrs}>\n${childrenHtml}\n${pad}</footer>`
    case 'Span':
      return `${pad}<span ${attrs}>${String(node.props.text ?? '')}</span>`
    case 'Heading': {
      const level =
        typeof node.meta?.headingLevel === 'number' && node.meta.headingLevel >= 1 && node.meta.headingLevel <= 6
          ? node.meta.headingLevel
          : 2
      return `${pad}<h${level} ${attrs}>${childrenHtml || String(node.props.text ?? '')}</h${level}>`
    }
    case 'Text':
      return `${pad}<p ${attrs}>${childrenHtml || String(node.props.text ?? '')}</p>`
    case 'Image':
      return `${pad}<img ${attrs} src="${String(node.meta?.src ?? node.props.src ?? '')}" alt="${String(node.meta?.alt ?? node.props.alt ?? '')}" />`
    case 'Button':
      return renderButton(node, cls, childrenHtml, pad)
    case 'Input':
      return `${pad}<input ${attrs} type="${String(node.props.type ?? 'text')}" placeholder="${String(node.props.placeholder ?? '')}" value="${String(node.props.value ?? '')}" />`
    case 'TextField':
      return `${pad}<input ${attrs} type="text" placeholder="${String(node.props.placeholder ?? '')}" value="${String(node.props.value ?? '')}" />`
    case 'TextArea':
      return `${pad}<textarea ${attrs} rows="${Math.max(2, Number(node.props.rows ?? 4))}" placeholder="${String(node.props.placeholder ?? '')}">${String(node.props.value ?? '')}</textarea>`
    case 'Select':
      return `${pad}<select ${attrs}>\n${childrenHtml}\n${pad}</select>`
    case 'Option':
      return `${pad}<option ${attrs} value="${String(node.props.value ?? '')}">${String(node.props.label ?? node.props.text ?? '')}</option>`
    case 'Checkbox':
      return `${pad}<label ${attrs}><input type="checkbox" ${node.props.checked ? 'checked' : ''} /> ${childrenHtml || String(node.props.label ?? '')}</label>`
    case 'Radio':
      return `${pad}<label ${attrs}><input type="radio" name="${String(node.props.name ?? '')}" ${node.props.checked ? 'checked' : ''} /> ${childrenHtml || String(node.props.label ?? '')}</label>`
    case 'Label':
      return `${pad}<label ${attrs}>${childrenHtml}</label>`
    case 'Form':
      return `${pad}<form ${attrs}>\n${childrenHtml}\n${pad}</form>`
    default:
      return `${pad}<div ${attrs} data-type="${node.type}">\n${childrenHtml}\n${pad}</div>`
  }
}

type CssBuckets = {
  base: string[]
  mobile: string[]
  tablet: string[]
  desktop: string[]
}

function collectCss(node: PageNode, out: CssBuckets): CssBuckets {
  const className = classNameFor(node)
  const baseBlock = styleToCssBlock(className, node.styles)
  if (baseBlock) out.base.push(baseBlock)
  const mobileBlock = styleToCssBlock(className, node.responsive?.mobile)
  if (mobileBlock) out.mobile.push(mobileBlock)
  const tabletBlock = styleToCssBlock(className, node.responsive?.tablet)
  if (tabletBlock) out.tablet.push(tabletBlock)
  const desktopBlock = styleToCssBlock(className, node.responsive?.desktop)
  if (desktopBlock) out.desktop.push(desktopBlock)

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
  const cssBuckets = collectCss(tree, {
    base: [],
    mobile: [],
    tablet: [],
    desktop: [],
  })
  const cssBlocks = cssBuckets.base.join('\n\n')
  const mobileBlocks = cssBuckets.mobile.join('\n\n')
  const tabletBlocks = cssBuckets.tablet.join('\n\n')
  const desktopBlocks = cssBuckets.desktop.join('\n\n')

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

  const css = `/* Generated by Sketch Me */

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
}

img {
  max-width: 100%;
  height: auto;
}

[data-navbar='true'] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.nav-item {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.nav-link {
  text-decoration: none;
  color: inherit;
  display: inline-flex;
  align-items: center;
}

.nav-submenu {
  list-style: none;
  margin: 0;
  padding: 8px 0;
  min-width: 180px;
  position: absolute;
  top: 100%;
  left: 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: #fff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  display: none;
  z-index: 20;
}

.nav-submenu a {
  display: block;
  padding: 8px 12px;
  color: inherit;
  text-decoration: none;
}

.nav-submenu a:hover {
  background: rgba(0, 0, 0, 0.05);
}

.nav-item:hover > .nav-submenu,
.nav-item:focus-within > .nav-submenu {
  display: block;
}

/* Common responsive helpers */
[class*='node-'][style*='grid-template-columns'] {
  width: 100%;
}

${cssBlocks}

@media (max-width: 767px) {
  [data-navbar='true'] {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .nav-item {
    width: 100%;
  }
  .nav-link {
    width: 100%;
    justify-content: space-between;
  }
  .nav-submenu {
    position: static !important;
    border: none;
    box-shadow: none;
    padding-top: 4px;
    display: block;
    background: transparent;
  }
  ${mobileBlocks}
}

@media (min-width: 768px) and (max-width: 1023px) {
  ${tabletBlocks}
}

@media (min-width: 1024px) {
  ${desktopBlocks}
}
`

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

function componentNameForNode(node: PageNode, index: number): string {
  const clean =
    node.type
      .replace(/[^a-zA-Z0-9]/g, '')
      .replace(/^[0-9]+/, '') || 'Section'
  return `${clean}Section${index + 1}`
}

function renderNodeJsx(node: PageNode, depth = 2): string {
  const pad = INDENT.repeat(depth)
  const cls = classNameFor(node)
  const childrenJsx = node.children.map((child) => renderNodeJsx(child, depth + 1)).join('\n')
  const childOrLabel = childrenJsx || `'${escapeJsString(String(node.props.label ?? node.props.text ?? ''))}'`

  switch (node.type) {
    case 'Page':
      return `${pad}<main className="${cls}">\n${childrenJsx}\n${pad}</main>`
    case 'Section':
      return `${pad}<section className="${cls}">\n${childrenJsx}\n${pad}</section>`
    case 'Container':
    case 'Columns':
      return `${pad}<div className="${cls}">\n${childrenJsx}\n${pad}</div>`
    case 'Divider':
      return `${pad}<hr className="${cls}" />`
    case 'Navbar':
      return `${pad}<nav className="${cls} nav-shell" data-navbar="true">\n${childrenJsx}\n${pad}</nav>`
    case 'Footer':
      return `${pad}<footer className="${cls}">\n${childrenJsx}\n${pad}</footer>`
    case 'Span':
      return `${pad}<span className="${cls}">${`{'${escapeJsString(String(node.props.text ?? ''))}'}`}</span>`
    case 'Heading': {
      const level =
        typeof node.meta?.headingLevel === 'number' && node.meta.headingLevel >= 1 && node.meta.headingLevel <= 6
          ? node.meta.headingLevel
          : 2
      return `${pad}<h${level} className="${cls}">${childrenJsx || `{ '${escapeJsString(String(node.props.text ?? ''))}' }`}</h${level}>`
    }
    case 'Text':
      return `${pad}<p className="${cls}">${childrenJsx || `{ '${escapeJsString(String(node.props.text ?? ''))}' }`}</p>`
    case 'Image':
      return `${pad}<img className="${cls}" src="${escapeJsString(String(node.meta?.src ?? node.props.src ?? ''))}" alt="${escapeJsString(String(node.meta?.alt ?? node.props.alt ?? ''))}" />`
    case 'Button': {
      const href = escapeJsString(String(node.meta?.href ?? node.props.href ?? '#'))
      if (!isTrue(node.props.navLink)) {
        return `${pad}<a className="${cls}" href="${href}">${childOrLabel}</a>`
      }
      const subMenu = parseSubMenu(node.props.subMenu)
      const submenuJsx =
        subMenu.length === 0
          ? ''
          : `\n${pad}  <ul className="nav-submenu">\n${subMenu
              .map(
                (item) =>
                  `${pad}    <li><a href="${escapeJsString(item.href)}">${`{'${escapeJsString(item.label)}'}`}</a></li>`,
              )
              .join('\n')}\n${pad}  </ul>`
      return `${pad}<div className="${cls} nav-item"><a className="nav-link" href="${href}">${childOrLabel}</a>${submenuJsx}\n${pad}</div>`
    }
    case 'Input':
      return `${pad}<input className="${cls}" type="${escapeJsString(String(node.props.type ?? 'text'))}" placeholder="${escapeJsString(String(node.props.placeholder ?? ''))}" defaultValue="${escapeJsString(String(node.props.value ?? ''))}" />`
    case 'TextField':
      return `${pad}<input className="${cls}" type="text" placeholder="${escapeJsString(String(node.props.placeholder ?? ''))}" defaultValue="${escapeJsString(String(node.props.value ?? ''))}" />`
    case 'TextArea':
      return `${pad}<textarea className="${cls}" rows={${Math.max(2, Number(node.props.rows ?? 4))}} placeholder="${escapeJsString(String(node.props.placeholder ?? ''))}" defaultValue="${escapeJsString(String(node.props.value ?? ''))}" />`
    case 'Select':
      return `${pad}<select className="${cls}">\n${childrenJsx}\n${pad}</select>`
    case 'Option':
      return `${pad}<option className="${cls}" value="${escapeJsString(String(node.props.value ?? ''))}">${`{'${escapeJsString(String(node.props.label ?? node.props.text ?? ''))}'}`}</option>`
    case 'Checkbox':
      return `${pad}<label className="${cls}"><input type="checkbox" defaultChecked={${Boolean(node.props.checked)}} /> ${childrenJsx || `{ '${escapeJsString(String(node.props.label ?? ''))}' }`}</label>`
    case 'Radio':
      return `${pad}<label className="${cls}"><input type="radio" name="${escapeJsString(String(node.props.name ?? ''))}" defaultChecked={${Boolean(node.props.checked)}} /> ${childrenJsx || `{ '${escapeJsString(String(node.props.label ?? ''))}' }`}</label>`
    case 'Label':
      return `${pad}<label className="${cls}">\n${childrenJsx}\n${pad}</label>`
    case 'Form':
      return `${pad}<form className="${cls}" onSubmit={(e) => e.preventDefault()}>\n${childrenJsx}\n${pad}</form>`
    default:
      return `${pad}<div className="${cls}" data-type="${escapeJsString(node.type)}">\n${childrenJsx}\n${pad}</div>`
  }
}

function buildReactFilesFromTree(tree: PageNode): ReactExportFile[] {
  const { css } = buildFilesFromTree(tree)
  const topSections = tree.children ?? []
  const componentFiles: ReactExportFile[] = []
  const imports: string[] = []
  const appChildren: string[] = []

  topSections.forEach((node, index) => {
    const componentName = componentNameForNode(node, index)
    imports.push(`import { ${componentName} } from './components/${componentName}'`)
    appChildren.push(`      <${componentName} />`)
    componentFiles.push({
      filename: `src/components/${componentName}.jsx`,
      content: `export function ${componentName}() {\n  return (\n${renderNodeJsx(node, 2)}\n  )\n}\n`,
      mime: 'text/javascript;charset=utf-8',
    })
  })

  const rootClass = classNameFor(tree)
  const appFile: ReactExportFile = {
    filename: 'src/App.jsx',
    content: `${imports.join('\n')}
import './styles.css'

export default function App() {
  return (
    <main className="${rootClass}">
${appChildren.join('\n')}
    </main>
  )
}
`,
    mime: 'text/javascript;charset=utf-8',
  }

  const mainFile: ReactExportFile = {
    filename: 'src/main.jsx',
    content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
    mime: 'text/javascript;charset=utf-8',
  }

  const htmlFile: ReactExportFile = {
    filename: 'index.html',
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${String(tree.props.title ?? 'React Export')}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
    mime: 'text/html;charset=utf-8',
  }

  const cssFile: ReactExportFile = {
    filename: 'src/styles.css',
    content: css,
    mime: 'text/css;charset=utf-8',
  }

  const packageJsonFile: ReactExportFile = {
    filename: 'package.json',
    content: `{
  "name": "sketch-me-react-export",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.0",
    "vite": "^8.0.0"
  }
}
`,
    mime: 'application/json;charset=utf-8',
  }

  const viteConfigFile: ReactExportFile = {
    filename: 'vite.config.js',
    content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`,
    mime: 'text/javascript;charset=utf-8',
  }

  const gitIgnoreFile: ReactExportFile = {
    filename: '.gitignore',
    content: `node_modules
dist
.DS_Store
`,
    mime: 'text/plain;charset=utf-8',
  }

  const readmeFile: ReactExportFile = {
    filename: 'README.md',
    content: `# React Export

Generated by Sketch Me.

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`
`,
    mime: 'text/markdown;charset=utf-8',
  }

  return [htmlFile, mainFile, appFile, cssFile, packageJsonFile, viteConfigFile, gitIgnoreFile, readmeFile, ...componentFiles]
}

export async function exportReactBuildFromTree(tree: PageNode) {
  const files = buildReactFilesFromTree(tree)
  const zip = new JSZip()
  files.forEach((file) => {
    zip.file(file.filename, file.content)
  })
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'sketch-me-react-export.zip'
  a.click()
  URL.revokeObjectURL(url)
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
