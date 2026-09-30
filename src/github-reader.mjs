import { resolveGitHubToken } from "./github-auth.mjs";

const API_ROOT = "https://api.github.com";

export function parseRepositoryName(value) {
  const input = String(value ?? "").trim();
  const match = /^([^/\s]+)\/([^/\s#]+)$/.exec(input);
  if (!match) throw new Error("repository_must_be_owner_slash_name");
  return match[1] + "/" + match[2];
}

function encodeRepo(repo) {
  const [owner, name] = parseRepositoryName(repo).split("/");
  return encodeURIComponent(owner) + "/" + encodeURIComponent(name);
}

function encodePath(path) {
  return String(path).split("/").map(encodeURIComponent).join("/");
}

function boundedLimit(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > 1000) {
    throw new Error("limit_must_be_integer_1_to_1000");
  }
  return number;
}

export function validateAuthorityPaths(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("config_authority_must_be_array");
  if (value.length > 32) throw new Error("config_authority_too_large");
  const unique = new Set();
  for (const item of value) {
    const path = String(item ?? "").trim().replace(/\\/g, "/");
    if (!path || path.startsWith("/") || path.split("/").some(part => part === ".." || part === "")) {
      throw new Error("config_authority_path_invalid:" + path);
    }
    unique.add(path);
  }
  return [...unique];
}

export class GitHubReader {
  constructor({
    token,
    limit = 200,
    fetchImpl = globalThis.fetch,
    authResolver = resolveGitHubToken,
  } = {}) {
    if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
    const auth = token === undefined
      ? authResolver()
      : { token: token || null, source: token ? "explicit" : "none" };
    this.token = auth.token;
    this.authSource = auth.source;
    this.limit = boundedLimit(limit);
    this.fetchImpl = fetchImpl;
  }

  async request(path, { notFoundNull = false } = {}) {
    const response = await this.fetchImpl(API_ROOT + path, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "repo-truth/0.1",
        ...(this.token ? { Authorization: "Bearer " + this.token } : {}),
      },
    });
    if (notFoundNull && response.status === 404) return null;
    const body = await response.text();
    if (!response.ok) {
      const error = new Error("github_api_error:" + response.status + ":" + body.slice(0, 300));
      error.status = response.status;
      throw error;
    }
    return body ? JSON.parse(body) : null;
  }

  async paginateWindow(path, limit = this.limit, { filter = () => true } = {}) {
    const bounded = boundedLimit(limit);
    const accepted = [];
    let sourceRows = 0;
    let exhausted = false;
    const perPage = Math.min(100, Math.max(1, bounded + 1));

    for (let page = 1; page <= 10; page += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const batch = await this.request(
        path + separator + "per_page=" + perPage + "&page=" + page,
      );
      if (!Array.isArray(batch)) throw new Error("github_collection_expected");
      sourceRows += batch.length;

      for (const row of batch) {
        if (filter(row)) accepted.push(row);
        if (accepted.length > bounded) break;
      }

      if (accepted.length > bounded) break;
      if (batch.length < perPage) {
        exhausted = true;
        break;
      }
    }

    return {
      rows: accepted.slice(0, bounded),
      truncated: accepted.length > bounded || !exhausted,
      source_rows_observed: sourceRows,
    };
  }

  async paginate(path, limit = this.limit) {
    return (await this.paginateWindow(path, limit)).rows;
  }

  async readTextFile(repo, path, ref) {
    const suffix = ref ? "?ref=" + encodeURIComponent(ref) : "";
    const row = await this.request(
      "/repos/" + encodeRepo(repo) + "/contents/" + encodePath(path) + suffix,
      { notFoundNull: true },
    );
    if (!row || Array.isArray(row) || row.type !== "file" || row.encoding !== "base64" || typeof row.content !== "string") {
      return null;
    }
    return Buffer.from(row.content.replace(/\n/g, ""), "base64").toString("utf8");
  }

  async load(repoInput, { limit = this.limit } = {}) {
    const repo = parseRepositoryName(repoInput);
    const bounded = boundedLimit(limit);
    const root = "/repos/" + encodeRepo(repo);
    let repository;
    try {
      repository = await this.request(root);
    } catch (error) {
      if (error?.status === 404 && !this.token) {
        const authError = new Error(
          "repository_not_found_or_private_auth_required:" + repo +
          ": run 'gh auth login' or set GH_TOKEN/GITHUB_TOKEN",
        );
        authError.status = 404;
        throw authError;
      }
      throw error;
    }

    const issueWindow = await this.paginateWindow(
      root + "/issues?state=all&sort=updated&direction=desc",
      bounded,
      { filter: row => !row.pull_request },
    );
    const pullWindow = await this.paginateWindow(
      root + "/pulls?state=all&sort=updated&direction=desc",
      bounded,
    );

    let commitWindow = {
      rows: [],
      truncated: false,
      source_rows_observed: 0,
    };
    try {
      commitWindow = await this.paginateWindow(
        root + "/commits?sha=" + encodeURIComponent(repository.default_branch),
        Math.min(bounded, 200),
      );
    } catch (error) {
      if (error.status !== 409) throw error;
    }

    let config = {};
    const configText = await this.readTextFile(repo, ".repo-truth.json", repository.default_branch);
    if (configText !== null) {
      try {
        config = JSON.parse(configText);
      } catch {
        throw new Error("config_json_invalid");
      }
    }
    const authorityPaths = validateAuthorityPaths(config.authority);
    const documents = [];
    for (const path of authorityPaths) {
      const document = await this.readTextFile(repo, path, repository.default_branch);
      if (document !== null) documents.push({ path, content: document });
    }

    return {
      repository,
      issues: issueWindow.rows,
      pulls: pullWindow.rows,
      commits: commitWindow.rows,
      authorityPaths,
      documents,
      configPresent: configText !== null,
      coverage: {
        requested_limit: bounded,
        observed_issue_roots: issueWindow.rows.length,
        issues_truncated: issueWindow.truncated,
        observed_pull_requests: pullWindow.rows.length,
        pulls_truncated: pullWindow.truncated,
        observed_commits: commitWindow.rows.length,
        commits_truncated: commitWindow.truncated,
      },
    };
  }
}