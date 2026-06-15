import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b'

const server = new Server(
  { name: 'ollama-mcp-bridge', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'ollama_generate',
      description:
        `Génère du code TypeScript via le modèle local ${OLLAMA_MODEL} (Ollama). ` +
        'Utiliser pour : créer des fonctions, écrire des tests unitaires, générer du boilerplate. ' +
        'Retourne uniquement le code, sans explication.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description:
              'Instruction précise : ce que le code doit faire, les types attendus, les contraintes.',
          },
          context: {
            type: 'string',
            description:
              'Code existant à prendre en compte (interfaces TypeScript, fichiers connexes, etc.).',
          },
          system: {
            type: 'string',
            description:
              'Instruction système optionnelle. Défaut : expert TypeScript/Node.js, retourne uniquement du code.',
          },
        },
        required: ['prompt'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'ollama_generate') {
    throw new Error(`Outil inconnu : ${request.params.name}`)
  }

  const { prompt, context, system } = request.params.arguments as {
    prompt: string
    context?: string
    system?: string
  }

  const systemPrompt =
    system ??
    'Tu es un expert TypeScript et Node.js. ' +
      'Réponds UNIQUEMENT avec du code TypeScript valide, sans explication ni markdown. ' +
      'Respecte les conventions ESM ("type": "module"), utilise des types stricts.'

  const fullPrompt = context
    ? `Contexte existant :\n\`\`\`typescript\n${context}\n\`\`\`\n\n${prompt}`
    : prompt

  const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      system: systemPrompt,
      prompt: fullPrompt,
      stream: false,
      options: {
        temperature: 0.2,      // faible pour du code déterministe
        num_predict: 4096,
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Ollama error ${response.status}: ${text}`)
  }

  const data = (await response.json()) as { response: string; done: boolean }

  // Nettoyer les balises markdown si le modèle les inclut quand même
  const code = data.response
    .replace(/^```(?:typescript|ts)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim()

  return {
    content: [{ type: 'text', text: code }],
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`ollama-mcp-bridge démarré — modèle : ${OLLAMA_MODEL} @ ${OLLAMA_HOST}`)
}

main().catch((err) => {
  console.error('Erreur fatale :', err)
  process.exit(1)
})
