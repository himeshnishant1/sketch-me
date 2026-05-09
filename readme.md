# Sketch Me — Website Builder

<img width="1919" height="901" alt="image" src="https://github.com/user-attachments/assets/fe315b9f-644a-4977-a50a-c54dc006e93c" />


Overview
--------
Sketch Me is a small React + TypeScript visual website builder with:
- A JSON-driven page tree model ([`PageNode`](frontend/src/types/pageTree.ts)).
- A live editor UI (React components under [`frontend/src/components/editor`](frontend/src/components/editor)).
- An AI assistant that can generate or patch page trees via a local MCP server ([`backend/server/mcp-server.js`](backend/server/mcp-server.js)).
- Export tooling to produce a simple static site (HTML/CSS/JS) from the page tree ([`buildPreviewDocumentFromTree`](frontend/src/utils/exportBuild.ts)).

Key files & symbols
- Frontend entry: [frontend/src/main.tsx](frontend/src/main.tsx)  
- Editor bootstrap: [frontend/src/components/editor/EditorApp.tsx](frontend/src/components/editor/EditorApp.tsx)  
- Page tree model: [frontend/src/types/pageTree.ts](frontend/src/types/pageTree.ts) (`PageNode`, `NodeMeta`, `StyleMap`)  
- Default demo tree: [`createDefaultPageTree`](frontend/src/stores/editorStore.ts) in [frontend/src/stores/editorStore.ts](frontend/src/stores/editorStore.ts)  
- Theme tokens & DOM init: [`initThemeDom`](frontend/src/stores/themeStore.ts) in [frontend/src/stores/themeStore.ts](frontend/src/stores/themeStore.ts)  
- Export / preview: [`buildPreviewDocumentFromTree`](frontend/src/utils/exportBuild.ts) and [`exportBuildFromTree`](frontend/src/utils/exportBuild.ts) in [frontend/src/utils/exportBuild.ts](frontend/src/utils/exportBuild.ts)  
- Import / parsing: [`parsePageTreeJson`](frontend/src/utils/importTree.ts) in [frontend/src/utils/importTree.ts](frontend/src/utils/importTree.ts)  
- AI chat UI: [frontend/src/components/editor/AiChatWidget.tsx](frontend/src/components/editor/AiChatWidget.tsx)  
- MCP server (AI patching / generation rules): [backend/server/mcp-server.js](backend/server/mcp-server.js)  
- Registry for built-in blocks: [frontend/src/registry/registerBuiltinBlocks.ts](frontend/src/registry/registerBuiltinBlocks.ts) and [frontend/src/registry/componentRegistry.ts](frontend/src/registry/componentRegistry.ts)  
- Toolbar import/export hooks: [frontend/src/components/editor/Toolbar.tsx](frontend/src/components/editor/Toolbar.tsx)  
- Canvas preview iframe: [frontend/src/components/editor/Canvas.tsx](frontend/src/components/editor/Canvas.tsx)  
- Deprecated/legacy prop warnings: [frontend/src/utils/deprecatedProps.ts](frontend/src/utils/deprecatedProps.ts)

Local setup (quick)
-------------------
Prereqs:
- Node.js 18+ and npm or pnpm/yarn
- (Optional) A Google Generative Language API key if you want the MCP AI features.

1. Install dependencies
   - Frontend:
     ```sh
     cd frontend
     npm install
     ```
     See [package.json](http://_vscodecontentref_/0).
   - Backend:
     ```sh
     cd backend
     npm install
     ```
     See [package.json](http://_vscodecontentref_/1).

2. Backend MCP server (optional, AI features)
   - Configure API key: edit [.env](http://_vscodecontentref_/2) or set [GOOGLE_API_KEY](http://_vscodecontentref_/3) in env.
   - Start server:
     ```sh
     cd backend
     npm run mcp
     ```
     The server exposes an endpoint at POST /api/mcp/page-tree (see backend/server/mcp-server.js).

3. Frontend dev server
   - From repository root:
     ```sh
     cd frontend
     npm run dev
     ```
   - Open the app in the browser (Vite will show the URL). The editor uses the MCP server at `http://localhost:4000/api/mcp/page-tree` by default; adjust if you run it elsewhere.

Common tasks
------------
- Export current canvas to JSON: toolbar "Export JSON" (uses frontend/src/components/editor/Toolbar.tsx).
- Import page-tree JSON: toolbar "Import JSON" → parsed with [parsePageTreeJson](http://_vscodecontentref_/4).
- Export a static build (index.html / styles.css / script.js): toolbar "Export Build" → [exportBuildFromTree](http://_vscodecontentref_/5).
- Preview: the editor renders a live preview via [buildPreviewDocumentFromTree](http://_vscodecontentref_/6) inside an iframe (see frontend/src/components/editor/Canvas.tsx).
- Edit the demo tree or starting content: change [createDefaultPageTree](http://_vscodecontentref_/7).

Notes & tips
------------
- AI assistant behavior and rules are implemented in [mcp-server.js](http://_vscodecontentref_/8). The server validates generated JSON and supports returning patches vs full trees.
- Theme tokens are applied to :root via [initThemeDom](http://_vscodecontentref_/9). Use the Properties panel to tweak tokens at runtime.
- The registry of blocks and their renderers live in [registry](http://_vscodecontentref_/10). Add custom block types by registering them with the [componentRegistry](http://_vscodecontentref_/11).
- The app warns about deprecated/legacy props during import via [frontend/src/utils/deprecatedProps.ts].

Build & lint
------------
- Frontend build:
  ```sh
  cd frontend
  npm run build
