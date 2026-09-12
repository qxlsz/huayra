/**
 * Session Index titles from the first user prompt.
 * Matches the CEF habit of replacing "session N" with a short prompt slug.
 */

export function titleFromPrompt(text) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= 40) return compact;
  const cut = compact.slice(0, 40);
  const softer = cut.replace(/\s+\S*$/, "").trim();
  return softer || cut;
}

export function shouldAutoTitle(title) {
  return !title || /^session\s+\d+$/i.test(String(title).trim());
}
