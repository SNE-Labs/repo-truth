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