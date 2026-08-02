import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import {
  askConnie,
  readJsonBody,
  jsonResponse,
} from "./server/connie-ai.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, "src");

/** Replace <!-- include:relative/path.html --> with file contents (recursive). */
function htmlIncludes() {
  const marker = /<!--\s*include:([^>\s]+)\s*-->/g;

  function expand(html, fromDir) {
    return html.replace(marker, (_, rel) => {
      const file = resolve(fromDir, rel.trim());
      if (!existsSync(file)) {
        throw new Error(`HTML include not found: ${rel} (from ${fromDir})`);
      }
      const inner = readFileSync(file, "utf8");
      return expand(inner, dirname(file));
    });
  }

  return {
    name: "html-includes",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return expand(html, srcDir);
      },
    },
  };
}

/** Local `/api/connie` — same contract as the Netlify function. */
function connieApiDev() {
  return {
    name: "connie-api-dev",
    configureServer(server) {
      const env = loadEnv(server.config.mode, __dirname, "");
      for (const [k, v] of Object.entries(env)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }

      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path !== "/api/connie") return next();

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== "POST") {
          jsonResponse(res, 405, { error: "Method not allowed" });
          return;
        }

        let input;
        try {
          input = await readJsonBody(req);
        } catch {
          jsonResponse(res, 400, { error: "Invalid JSON body" });
          return;
        }

        try {
          const { reply, model } = await askConnie(input);
          jsonResponse(res, 200, { reply, model });
        } catch (err) {
          if (err.code === "NO_KEY") {
            jsonResponse(res, 503, {
              error: "Connie AI is not configured",
              code: "NO_KEY",
            });
            return;
          }
          if (err.code === "BAD_REQUEST") {
            jsonResponse(res, 400, { error: err.message, code: "BAD_REQUEST" });
            return;
          }
          console.error("Connie AI error:", err.message || err);
          jsonResponse(res, 502, {
            error: "Connie could not reach the AI right now",
            code: err.code || "OPENAI",
          });
        }
      });
    },
  };
}

export default defineConfig({
  root: "src",
  envDir: __dirname,
  publicDir: resolve(__dirname, "public"),
  plugins: [htmlIncludes(), connieApiDev()],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    open: false,
    // Allow Cloudflare Tunnel hostnames (*.trycloudflare.com)
    allowedHosts: true,
  },
});
