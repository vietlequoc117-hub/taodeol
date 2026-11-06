import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Parse command line arguments if provided (e.g. --port 3000 --host 0.0.0.0)
  let cliPort: number | null = null;
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const val = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(val)) cliPort = val;
  }

  let cliHost: string | null = null;
  const hostArgIndex = process.argv.indexOf('--host');
  if (hostArgIndex !== -1 && process.argv[hostArgIndex + 1] && !process.argv[hostArgIndex + 1].startsWith('-')) {
    cliHost = process.argv[hostArgIndex + 1];
  }

  const isProduction = process.env.NODE_ENV === 'production';
  // In development, the applet dev server must run on port 3000 (port 8080 is reserved for nginx).
  // In production (Cloud Run), listen on process.env.PORT (defaults to 8080).
  const PORT = cliPort || (isProduction ? (process.env.PORT ? parseInt(process.env.PORT, 10) : 8080) : 3000);
  const HOST = cliHost || '0.0.0.0';

  // Middleware
  app.use(express.json({ limit: '50mb' }));

  // Initialize Gemini AI SDK with server-side API key and User-Agent
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'undefined'),
    });
  });

  const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

  async function generateContentWithFallback(preferredModel: string, contents: any, config?: any) {
    const modelsToTry = [preferredModel, ...FALLBACK_MODELS.filter((m) => m !== preferredModel)];
    let lastError: any = null;
    for (const modelName of modelsToTry) {
      try {
        return await ai.models.generateContent({
          model: modelName,
          contents,
          config,
        });
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err || '');
        const isTransient =
          err?.status === 503 ||
          err?.status === 429 ||
          msg.includes('503') ||
          msg.includes('429') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('high demand');
        if (!isTransient) {
          throw err;
        }
        console.warn(`Model ${modelName} returned transient error (${msg.slice(0, 120)}), falling back to next model...`);
      }
    }
    throw lastError;
  }

  // Gemini exam parsing endpoint
  app.post('/api/gemini/parse-exam', async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'undefined') {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server. You can configure your attached API key in the Settings > Secrets panel.',
        });
      }

      const response = await generateContentWithFallback('gemini-3.8-flash', prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            part1: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  answer: { type: Type.NUMBER },
                  explanation: { type: Type.STRING, description: 'Detailed explanation if present in the text' },
                },
                required: ['id', 'question', 'options', 'answer'],
              },
            },
            part2: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  question: { type: Type.STRING },
                  explanation: { type: Type.STRING, description: 'Detailed explanation if present for the overall question' },
                  subQuestions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        text: { type: Type.STRING, description: 'The complete text of the sub-question, including any multi-line code blocks, SQL statements, or explanations' },
                        answer: { type: Type.BOOLEAN, description: 'True if the sub-question is underlined in HTML, False otherwise.' },
                        explanation: { type: Type.STRING, description: 'Detailed explanation for this specific sub-question if present' },
                      },
                      required: ['id', 'text', 'answer'],
                    },
                  },
                },
                required: ['id', 'question', 'subQuestions'],
              },
            },
            part3: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING },
                  explanation: { type: Type.STRING, description: 'Detailed explanation if present in the text' },
                },
                required: ['id', 'question', 'answer'],
              },
            },
          },
          required: ['part1', 'part2', 'part3'],
        },
      });

      return res.json({ text: response.text });
    } catch (error: any) {
      console.error('Server Gemini parse-exam error:', error);
      return res.status(500).json({ error: error?.message || 'Failed to process exam with Gemini' });
    }
  });

  // Generic Gemini generate endpoint
  app.post('/api/gemini/generate', async (req: Request, res: Response) => {
    try {
      const { model = 'gemini-3.8-flash', contents, config } = req.body;
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'undefined') {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server. You can configure your attached API key in the Settings > Secrets panel.',
        });
      }

      const response = await generateContentWithFallback(model, contents, config);

      return res.json({ text: response.text });
    } catch (error: any) {
      console.error('Server Gemini generate error:', error);
      return res.status(500).json({ error: error?.message || 'Gemini generateContent failed' });
    }
  });

  // Streaming endpoint for Gemini content streaming
  app.post('/api/gemini/stream', async (req: Request, res: Response) => {
    try {
      const { model = 'gemini-3.8-flash', contents, config } = req.body;
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'undefined') {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server. You can configure your attached API key in the Settings > Secrets panel.',
        });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const responseStream = await ai.models.generateContentStream({
        model,
        contents,
        config,
      });

      for await (const chunk of responseStream) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error('Server Gemini stream error:', error);
      if (!res.headersSent) {
        return res.status(500).json({ error: error?.message || 'Streaming failed' });
      }
      res.end();
    }
  });

  // Vite development vs production serving
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });

  const handleShutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}

startServer();
