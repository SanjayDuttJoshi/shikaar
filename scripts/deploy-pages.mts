/**
 * Publishes the game to GitHub Pages (free) at https://<user>.github.io/shikaar/.
 * Steps: type-check + unit tests, build for /shikaar, replace the gh-pages branch contents
 * with the build, push, then rebuild the normal local copy.
 * Usage: npm run deploy
 *
 * Pushes use the repo's own git identity and credential helper (set once with
 * `git config --local`), so whichever GitHub account is active in `gh` doesn't matter.
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SITE_PATH = "/shikaar";
const BRANCH = "gh-pages";

const run = (cmd: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) =>
  execFileSync(cmd, args, { stdio: "inherit", ...options });
const read = (args: string[], cwd?: string): string => execFileSync("git", args, { encoding: "utf8", cwd }).trim();

const remote = read(["remote", "get-url", "origin"]);
const name = read(["config", "user.name"]);
const email = read(["config", "user.email"]);
const helper = read(["config", "--local", "--get-all", "credential.helper"]).split("\n").filter(Boolean).pop() ?? "";

const gitIn = (cwd: string, ...args: string[]) =>
  run("git", ["-c", `user.name=${name}`, "-c", `user.email=${email}`, "-c", "credential.helper=", "-c", `credential.helper=${helper}`, ...args], { cwd });

run("npx", ["tsc", "--noEmit"]);
run("npx", ["vitest", "run"]);

const dir = mkdtempSync(join(tmpdir(), "shikaar-pages-"));
try {
  run("npm", ["run", "build"], { env: { ...process.env, PAGES_BASE_PATH: SITE_PATH } });
  const exists = execFileSync("git", ["-c", "credential.helper=", "-c", `credential.helper=${helper}`, "ls-remote", "--heads", remote, BRANCH], { encoding: "utf8" }).trim() !== "";
  if (exists) {
    gitIn(process.cwd(), "clone", "--quiet", "--depth", "1", "--branch", BRANCH, remote, dir);
  } else {
    gitIn(dir, "init", "--quiet");
    gitIn(dir, "checkout", "--quiet", "--orphan", BRANCH);
    gitIn(dir, "remote", "add", "origin", remote);
  }
  for (const entry of readdirSync(dir)) if (entry !== ".git") rmSync(join(dir, entry), { recursive: true, force: true });
  cpSync("out", dir, { recursive: true });
  writeFileSync(join(dir, ".nojekyll"), "");
  writeFileSync(join(dir, "404.html"), `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${SITE_PATH}/"><title>SHIKAAR</title>`);
  gitIn(dir, "add", "-A");
  gitIn(dir, "commit", "-q", "-m", `Deploy ${new Date().toISOString()}`);
  gitIn(dir, "push", "origin", BRANCH);
} finally {
  rmSync(dir, { recursive: true, force: true });
  run("npm", ["run", "build"]);
}
const owner = remote.match(/github\.com[/:]([^/]+)\//)?.[1]?.toLowerCase() ?? "<user>";
console.log(`\nDeployed. Live in about a minute at https://${owner}.github.io${SITE_PATH}/`);
