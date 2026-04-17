import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Local-dev shim: in production, /api/feedback is served by Vercel as a serverless
// function. In `npm run dev` Vite has no /api router, so this plugin loads the
// same handler module and runs it as Express-style middleware.
function apiDevServer(env: Record<string, string>): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        const route = req.url.split('?')[0].replace(/^\/api\//, '');
        try {
          // Dynamic import so the handler isn't bundled into the client.
          const mod = await server.ssrLoadModule(`/api/${route}.ts`);
          // Provide env to process.env for the handler
          for (const [k, v] of Object.entries(env)) {
            if (process.env[k] === undefined) process.env[k] = v;
          }
          // Read body
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const raw = Buffer.concat(chunks).toString('utf8');
          let body: any = undefined;
          if (raw) {
            try { body = JSON.parse(raw); } catch { body = raw; }
          }
          // Express-style res shim
          const shimRes = {
            status(code: number) { res.statusCode = code; return shimRes; },
            json(obj: any) {
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify(obj));
            },
            end(s?: string) { res.end(s); },
          };
          await mod.default({ method: req.method, body, url: req.url }, shimRes);
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: err?.message ?? 'dev middleware error' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), apiDevServer(env)],
  };
});
