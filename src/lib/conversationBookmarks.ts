// Sistema de "Marcar página" para conversas (chat e chat-beta).
// Persistência local por operador via localStorage. Sincroniza entre componentes
// abertos na mesma aba via CustomEvent.
//
// Não interfere no sistema de "marcado_nao_lido" (que segue tendo bugs próprios).

const EVENT_NAME = "conversation-bookmarks:updated";

const storageKey = (userId: string | null | undefined) =>
  `conversation_bookmarks::${userId || "anon"}`;

export function getBookmarks(userId: string | null | undefined): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveBookmarks(userId: string | null | undefined, set: Set<string>) {
  try {
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify(Array.from(set))
    );
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: { userId: userId || "anon" } })
    );
  } catch {
    /* noop */
  }
}

export function isBookmarked(
  userId: string | null | undefined,
  telefone: string
): boolean {
  return getBookmarks(userId).has(telefone);
}

export function toggleBookmark(
  userId: string | null | undefined,
  telefone: string
): boolean {
  const set = getBookmarks(userId);
  let nowBookmarked: boolean;
  if (set.has(telefone)) {
    set.delete(telefone);
    nowBookmarked = false;
  } else {
    set.add(telefone);
    nowBookmarked = true;
  }
  saveBookmarks(userId, set);
  return nowBookmarked;
}

export function subscribeBookmarks(
  userId: string | null | undefined,
  cb: () => void
): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as { userId: string } | undefined;
    if (!detail || detail.userId === (userId || "anon")) cb();
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
