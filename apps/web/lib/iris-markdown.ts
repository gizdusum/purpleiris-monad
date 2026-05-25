const MARKER_COLORS = {
  ok: "#4ade80",
  warn: "#fbbf24",
  err: "#f87171",
  num: "#c4b5fd",
  stat: "#e2e8f0",
  dim: "#8a82c4",
} as const;

export function applyIrisMarkers(text: string): string {
  const pattern = /\[(ok|warn|err|num|stat|dim)\]([\s\S]*?)\[\/\1\]/g;
  let result = text.replace(pattern, (_, kind, content) => {
    const color = MARKER_COLORS[kind as keyof typeof MARKER_COLORS];
    return `<span style="color:${color}">${content}</span>`;
  });
  // Strip orphaned opening markers (mid-stream incomplete pairs or malformed model output)
  result = result.replace(/\[(ok|warn|err|num|stat|dim)\]/g, "");
  // Strip orphaned closing markers
  result = result.replace(/\[\/(ok|warn|err|num|stat|dim)\]/g, "");
  // Strip partial/incomplete marker at the streaming tail (e.g. "[dim" before "]" arrives)
  result = result.replace(
    /\[\/?(?:o(?:k)?|w(?:a(?:r(?:n)?)?)?|e(?:r(?:r)?)?|n(?:u(?:m)?)?|s(?:t(?:a(?:t)?)?)?|d(?:i(?:m)?)?)?$/i,
    ""
  );
  return result;
}

export function parseSuggestions(content: string): {
  displayContent: string;
  suggestions: string[];
} {
  const match = /\n?%%SUGGESTIONS%%\n([\s\S]*?)%%END%%/.exec(content);
  if (!match || !match[1]) return { displayContent: content, suggestions: [] };
  const suggestions = match[1]
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const displayContent = content.replace(/\n?%%SUGGESTIONS%%[\s\S]*?%%END%%/, "").trim();
  return { displayContent, suggestions };
}

// During streaming, hide the suggestions block as soon as the sentinel appears
export function stripSuggestionsForStream(text: string): string {
  const idx = text.indexOf("%%SUGGESTIONS%%");
  return idx === -1 ? text : text.slice(0, idx).trim();
}
