export const demoRepository = {
  full_name: "acme/demo",
  updated_at: "2026-09-30T00:00:00Z",
};

export const demoIssues = [
  {
    number: 1,
    title: "Ship the parser",
    body: "",
    state: "open",
    labels: [],
    updated_at: "2026-09-30T00:00:00Z",
    html_url: "https://github.com/acme/demo/issues/1",
  },
  {
    number: 2,
    title: "Use the old cache",
    body: "",
    state: "open",
    labels: [],
    updated_at: "2026-09-30T00:00:00Z",
    html_url: "https://github.com/acme/demo/issues/2",
  },
  {
    number: 3,
    title: "Publish the release",
    body: "Depends on Issue #4",
    state: "open",
    labels: [],
    updated_at: "2026-09-30T00:00:00Z",
    html_url: "https://github.com/acme/demo/issues/3",
  },
  {
    number: 4,
    title: "Finish release notes",
    body: "",
    state: "open",
    labels: [],
    updated_at: "2026-09-30T00:00:00Z",
    html_url: "https://github.com/acme/demo/issues/4",
  },
];

export const demoAuthorityPaths = ["ROADMAP.md"];

export const demoDocuments = [
  {
    path: "ROADMAP.md",
    content: [
      "Current implementation: Issue #1",
      "Issue #2 is superseded",
      "Current implementation: Issue #3",
      "Current implementation: Issue #4",
    ].join("\n"),
  },
];
