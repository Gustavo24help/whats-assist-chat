/**
 * Validador de links de pagamento Asaas.
 *
 * Formatos aceitos (produção e sandbox):
 *   - https://www.asaas.com/c/<codigo>
 *   - https://www.asaas.com/i/<codigo>        (invoice / cobrança direta)
 *   - https://www.asaas.com/b/pix/<codigo>    (pix)
 *   - https://sandbox.asaas.com/c/<codigo>    (sandbox — para testes)
 *   - https://sandbox.asaas.com/i/<codigo>
 *
 * Subdomínios `www.` e `sandbox.` são opcionais.
 */

const ASAAS_HOST_RE = /^(www\.|sandbox\.)?asaas\.com$/i;
const ASAAS_PATH_RE = /^\/(c|i|b\/pix)\/[A-Za-z0-9_-]{4,}$/;

export interface AsaasValidation {
  ok: boolean;
  /** URL normalizada (sem query/hash). Vazia se raw estava vazio. */
  normalized: string;
  /** Motivo da rejeição (vazio quando ok=true). */
  reason: string;
}

export function validateAsaasLink(raw: string | null | undefined): AsaasValidation {
  if (!raw || !raw.trim()) {
    return { ok: true, normalized: '', reason: '' };
  }

  const trimmed = raw.trim();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, normalized: '', reason: 'URL inválida. Cole um link completo (ex: https://www.asaas.com/c/abc123).' };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, normalized: '', reason: 'O link deve usar http:// ou https://' };
  }

  if (!ASAAS_HOST_RE.test(url.hostname)) {
    return {
      ok: false,
      normalized: '',
      reason: `Domínio "${url.hostname}" não é Asaas. Apenas links asaas.com ou sandbox.asaas.com são aceitos.`,
    };
  }

  if (!ASAAS_PATH_RE.test(url.pathname)) {
    return {
      ok: false,
      normalized: '',
      reason: 'Formato do link Asaas não reconhecido. Use /c/..., /i/... ou /b/pix/...',
    };
  }

  return { ok: true, normalized: `${url.protocol}//${url.hostname}${url.pathname}`, reason: '' };
}

export function isValidAsaasLink(raw: string | null | undefined): boolean {
  return validateAsaasLink(raw).ok;
}
