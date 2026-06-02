// Operadores que assumem conversas de outros automaticamente,
// sem mostrar o AlertDialog de confirmação ao enviar mensagem.
// Match feito pelo primeiro nome (normalizado, sem acento, lowercase).
const AUTO_TAKEOVER_FIRST_NAMES = ["paula", "valentina"];

export function shouldAutoTakeover(fullName?: string | null): boolean {
  if (!fullName) return false;
  const first = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase();
  return !!first && AUTO_TAKEOVER_FIRST_NAMES.includes(first);
}
