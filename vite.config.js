import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { askOpenAI } from "./server/connie.mjs";

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

/** Local /api/connie. No key → { error: "no openai key" }, and the site uses the keyword answers. */
function connieDevApi(env) {
  return {
    name: "connie-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/connie", (req, res, next) => {
        if (req.method !== "POST") return next();
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", async () => {
          let body = {};
          try {
            body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          } catch {
            body = {};
          }
          try {
            const result = await askOpenAI({
              apiKey: env.OPENAI_API_KEY || "",
              model: env.OPENAI_MODEL || "",
              question: body.question,
              tier: body.tier,
              history: body.history,
              context: body.context,
            });
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch (err) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "openai error" }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  return {
    root: "src",
    /* .env lives next to this config file, not inside src/ */
    envDir: __dirname,
    publicDir: resolve(__dirname, "public"),
    plugins: [htmlIncludes(), connieDevApi(env)],
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
  };
});
