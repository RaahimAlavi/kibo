import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { Readable } from 'stream';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.ELEVENLABS_API_KEY && !process.env.ELEVENLABS_API_KEY) {
    process.env.ELEVENLABS_API_KEY = env.ELEVENLABS_API_KEY;
  }

  return {
    base: '/',
    plugins: [
      react(),
      {
        name: 'elevenlabs-dev-tts',
        configureServer(server) {
          server.middlewares.use('/api/elevenlabs-tts', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const { text, voiceId, modelId } = JSON.parse(body || '{}');
                const client = new ElevenLabsClient();
                const audioStream = await client.textToSpeech.convert(voiceId || 'EXAVITQu4vr4xnSDxMaL', {
                  text: text || '',
                  modelId: modelId || 'eleven_flash_v2_5',
                  outputFormat: 'mp3_44100_128',
                });
                res.setHeader('Content-Type', 'audio/mpeg');
                Readable.fromWeb(audioStream as any).pipe(res);
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err?.message || 'ElevenLabs TTS error' }));
              }
            });
          });
        },
      },
      {
        name: 'three-legacy-encoding-shim',
        transform(code, id) {
          if (id.replace(/\\/g, '/').includes('node_modules/three/build/three.module.js')) {
            return {
              code: `${code}\nexport const sRGBEncoding = 3001;\nexport const LinearEncoding = 3000;\n`,
              map: null,
            };
          }
        },
      },
    ],
    server: {
      port: 5173,
      open: false,
    },
    build: {
      chunkSizeWarningLimit: 1200,
    },
  };
});

