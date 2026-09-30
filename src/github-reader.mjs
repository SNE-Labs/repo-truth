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
    token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null,
    limit = 200,
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
    this.token = token;
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

  async paginate(path, limit = this.limit) {
    const bounded = boundedLimit(limit);
    const rows = [];
    const perPage = Math.min(100, bounded);
    for (let page = 1; rows.length < bounded && page <= 10; page += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const batch = await this.request(path + separator + "per_page=" + perPage + "&page=" + page);
      if (!Array.isArray(batch)) throw new Error("github_collection_expected");
      rows.push(...batch);
      if (batch.length < perPage) break;
    }
    return rows.slice(0, bounded);
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
    const repository = await this.request(root);
    const issueRows = await this.paginate(
      root + "/issues?state=all&sort=updated&direction=desc",
      Math.min(1000, bounded * 2),
    );
    const issues = issueRows.filter(row => !row.pull_request).slice(0, bounded);
    const pulls = await this.paginate(
      root + "/pulls?state=all&sort=updated&direction=desc",
      bounded,
    );
    let commits = [];
    try {
      commits = await this.paginate(
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
      issues,
      pulls,
      commits,
      authorityPaths,
      documents,
      configPresent: configText !== null,
    };
  }
}
