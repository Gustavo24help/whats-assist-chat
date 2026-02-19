export function parseOperationalScore(text) {
  const normalized = (text ?? "").trim();
  const match = normalized.match(/^[1-5]$/);
  return match ? Number.parseInt(match[0], 10) : null;
}

export function parseNpsScore(text) {
  const normalized = (text ?? "").trim();
  const match = normalized.match(/^(10|[0-9])$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function shouldProcessOperationalFirst({ text, hasPendingOperational }) {
  return hasPendingOperational && parseOperationalScore(text) !== null;
}

export function classifyNps(score) {
  if (score >= 9) return "promotor";
  if (score >= 7) return "neutro";
  return "detrator";
}

export function npsFeedbackType(score) {
  if (score >= 9) return "positivo";
  if (score >= 7) return "neutro";
  return "negativo";
}
