import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Load .env only in non-production
if (process.env.NODE_ENV !== 'production') {
    const dotenvPath = path.resolve(__dirname, '.env');
    // dynamic import so dotenv isn't required in production build
    const dotenv = (await import('dotenv')).default;
    dotenv.config({ path: dotenvPath });
}

function getEnv(name, { required = false, defaultValue = undefined } = {}) {
    const val = process.env[name] ?? defaultValue;
    if (required && (val === undefined || val === '')) {
        console.error(`Missing required environment variable: ${name}`);
        process.exit(1);
    }
    return val;
}

// Read envs (in production these come from the host)
const PORT = parseInt(getEnv('PORT', { defaultValue: '4000' }), 10);
const GOOGLE_API_KEY = getEnv('GOOGLE_API_KEY', { required: process.env.NODE_ENV === 'production' });

// Warn in dev if optional keys are missing
if (!GOOGLE_API_KEY && process.env.NODE_ENV !== 'production') {
    console.warn('GOOGLE_API_KEY not set — AI features disabled in development.');
}

app.use(express.json());

app.post('/api/mcp/page-tree', async (req, res) => {
  const {
    prompt,
    context = [],
    temperature = 0.0,
    has_to_updated = false,
    tree = null,
  } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Prompt is required.' })
    return
  }
  if (has_to_updated) {
    if (!isPlainObject(tree)) {
      res.status(400).json({ error: 'tree is required when has_to_updated is true.' })
      return
    }
    const treeErrors = validatePageTreeDocument(tree)
    if (treeErrors.length > 0) {
      res.status(422).json({
        error: 'Input tree violates page-tree rulebook.',
        details: treeErrors,
      })
      return
    }
  }

  const controller = new AbortController()
  req.on('aborted', () => controller.abort())
  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })

  try {
    if (!genAI) {
      res.status(500).json({
        error: 'Gemini SDK is not configured.',
        details: 'GOOGLE_API_KEY is missing.',
      })
      return
    }

    const modelId = await getResolvedModelId(controller.signal)
    const model = genAI.getGenerativeModel({ model: modelId })
    const history = Array.isArray(context)
      ? context
          .map((msg) => {
            if (!msg || typeof msg.content !== 'string') return null
            if (msg.role === 'assistant') return { role: 'model', parts: [{ text: msg.content }] }
            if (msg.role === 'user') return { role: 'user', parts: [{ text: msg.content }] }
            return null
          })
          .filter(Boolean)
      : []

    const instruction = has_to_updated
      ? `${PAGE_TREE_PATCH_RULEBOOK}\n\nCurrent tree:\n${JSON.stringify(tree)}\n\nUser request:\n${prompt}`
      : `${PAGE_TREE_RULEBOOK}\n\nUser request:\n${prompt}`

    const result = await model.generateContent({
      contents: [...history, { role: 'user', parts: [{ text: instruction }] }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
      },
    })
    const rawText = result?.response?.text?.() || ''

    let modelJson
    try {
      modelJson = JSON.parse(rawText)
    } catch {
      res.status(502).json({
        error: 'Model returned non-JSON output.',
        details: 'Expected one JSON object parseable by JSON.parse.',
        raw: rawText,
      })
      return
    }

    if (has_to_updated) {
      const patchErrors = validatePatchAgainstTree(tree, modelJson)
      if (patchErrors.length > 0) {
        res.status(422).json({
          error: 'Generated patch violates patch rulebook.',
          details: patchErrors,
          model: modelId,
          patch: modelJson,
        })
        return
      }

      const updatedTree = applyPatch(tree, modelJson)
      const updatedTreeErrors = validatePageTreeDocument(updatedTree)
      if (updatedTreeErrors.length > 0) {
        res.status(422).json({
          error: 'Generated patch produced an invalid page tree.',
          details: updatedTreeErrors,
          model: modelId,
          patch: modelJson,
        })
        return
      }

      res.json(modelJson)
      return
    }

    const validationErrors = validatePageTreeDocument(modelJson)
    if (validationErrors.length > 0) {
      res.status(422).json({
        error: 'Generated JSON violates page-tree rulebook.',
        details: validationErrors,
        model: modelId,
        pageTree: modelJson,
      })
      return
    }

    res.json({
      pageTree: modelJson,
      model: modelId,
    })
  } catch (error) {
    if (error.name === 'AbortError') {
      res.status(499).json({ error: 'Request aborted.' })
      return
    }
    const msg = String(error.message || '')
    if (/404|not found|is not supported for generateContent/i.test(msg)) {
      resolvedModelCache = { id: null, expiresAt: 0 }
    }
    res.status(500).json({
      error: 'MCP page-tree generation failed.',
      details: error.message || 'Unknown error',
    })
  }
})

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`MCP server listening on http://0.0.0.0:${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
});
