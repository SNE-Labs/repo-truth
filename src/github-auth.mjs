import { execFileSync } from "node:child_process";

export function resolveGitHubToken({
  env = process.env,
  execFile = execFileSync,
  cwd = process.cwd(),
} = {}) {
  const explicit = String(env.GITHUB_TOKEN || env.GH_TOKEN || "").trim();
  if (explicit) {
    return {
      token: explicit,
      source: env.GITHUB_TOKEN ? "GITHUB_TOKEN" : "GH_TOKEN",
    };
  }

  try {
    const token = String(execFile("gh", ["auth", "token"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }) ?? "").trim();
    if (token) {
      return { token, source: "gh_cli" };
    }
  } catch {
    // gh is missing or not authenticated. The caller will continue unauthenticated.
  }

  return { token: null, source: "none" };
}
