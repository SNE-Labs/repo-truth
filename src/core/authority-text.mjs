export function stripFencedAuthorityExamples(text = "") {
  const lines = String(text ?? "").split(/\r?\n/);
  const kept = [];
  let fence = null;
  for (const line of lines) {
    const trimmed = line.trimStart();
    const match = trimmed.match(/^(`{3,}|~{3,})/);
    if (match) {
      const marker = match[1][0];
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence === null) kept.push(line);
  }
  return kept.join("\n");
}

export function stripAuthorityExamples(text = "") {
  const withoutFences = stripFencedAuthorityExamples(text);
  const withoutComments = withoutFences.replace(/<!--[\s\S]*?-->/g, "");
  const kept = [];
  for (const line of withoutComments.split(/\r?\n/)) {
    if (/^\s*>/.test(line)) continue;
    kept.push(line.replace(/`[^`\n]*`/g, ""));
  }
  return kept.join("\n");
}
