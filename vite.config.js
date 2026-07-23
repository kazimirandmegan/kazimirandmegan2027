import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

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

export default defineConfig({
  root: "src",
  publicDir: resolve(__dirname, "public"),
  plugins: [htmlIncludes()],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    open: false,
  },
});
