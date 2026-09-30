import { execFileSync } from "node:child_process";

function stripGitSuffix(value) {
  return value.endsWith(".git") ? value.slice(0, -4) : value;
}

export function repositoryFromRemote(value) {
  const remote = String(value ?? "").trim();
  if (!remote) throw new Error("git_remote_missing");

  const https = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/?$/i.exec(remote);
  if (https) return https[1] + "/" + stripGitSuffix(https[2]);

  const scp = /^git@github\.com:([^/\s]+)\/([^/\s]+)$/i.exec(remote);
  if (scp) return scp[1] + "/" + stripGitSuffix(scp[2]);

  const ssh = /^ssh:\/\/git@github\.com\/([^/\s]+)\/([^/\s]+)\/?$/i.exec(remote);
  if (ssh) return ssh[1] + "/" + stripGitSuffix(ssh[2]);

  throw new Error("git_remote_must_be_github");
}

export function resolveRepositoryTarget(value, {
  cwd = process.cwd(),
  execFile = execFileSync,
} = {}) {
  const target = String(value ?? "").trim();
  if (!target) throw new Error("repository_required");

  if (target === ".") {
    let remote;
    try {
      remote = execFile("git", ["config", "--get", "remote.origin.url"], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      throw new Error("git_origin_unavailable: use owner/name or run inside a GitHub clone");
    }
    return repositoryFromRemote(remote);
  }

  const url = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#]+)(?:\/?(?:#.*)?)?$/i.exec(target);
  if (url) return url[1] + "/" + stripGitSuffix(url[2]);

  const pair = /^([^/\s]+)\/([^/\s#]+)$/.exec(target);
  if (pair) return pair[1] + "/" + stripGitSuffix(pair[2]);

  throw new Error("repository_must_be_owner_slash_name_github_url_or_dot");
}