/**
 * Husky installer: run only when in a git repo (e.g. clone + npm install).
 * Skip when installed from npm registry (no .git), in CI, or in production.
 * See https://typicode.github.io/husky/how-to.html#ci-server-and-docker
 */
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const hasGit = existsSync(resolve(packageRoot, ".git"));

if (
  !hasGit ||
  process.env.CI === "true" ||
  process.env.NODE_ENV === "production"
) {
  process.exit(0);
}

const { default: husky } = await import("husky");
console.log(husky());
