const TEMPLATE_PLACEHOLDER_REGEX = /\{\{\s*([^{}]+?)\s*\}\}/g;

const VARIABLE_ALIAS_BY_INDEX: Record<number, string> = {
  0: "nome",
  1: "ficha_de_servico",
  2: "status_do_servico",
};

const DEFAULT_FIELD_BY_INDEX: Record<number, string> = {
  0: "cliente.nome",
  1: "ficha.nome_ficha",
  2: "ficha.status",
};

const DEFAULT_FIELD_BY_ALIAS: Record<string, string> = {
  nome: "cliente.nome",
  ficha_de_servico: "ficha.nome_ficha",
  status_do_servico: "ficha.status",
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const normalizeTemplateVariableToken = (token: string) =>
  token.replace(/^\{\{\s*|\s*\}\}$/g, "").replace(/^["']+|["']+$/g, "").trim();

export const formatTemplatePlaceholder = (token: string) =>
  `{{${normalizeTemplateVariableToken(token)}}}`;

export const extractTemplateVariablesFromBody = (body?: string | null) => {
  if (!body) return [];

  const matches = Array.from(body.matchAll(TEMPLATE_PLACEHOLDER_REGEX)).map((match) =>
    normalizeTemplateVariableToken(match[1]),
  );

  return [...new Set(matches.filter(Boolean))];
};

export const normalizeTemplateVariables = (variables?: string[] | null, body?: string | null) => {
  const explicitVariables = Array.isArray(variables)
    ? [...new Set(variables.map(normalizeTemplateVariableToken).filter(Boolean))]
    : [];

  if (explicitVariables.length > 0) {
    return explicitVariables;
  }

  return extractTemplateVariablesFromBody(body);
};

export const getDefaultTemplateField = (token: string, index: number) => {
  const normalizedToken = normalizeTemplateVariableToken(token);

  if (DEFAULT_FIELD_BY_ALIAS[normalizedToken]) {
    return DEFAULT_FIELD_BY_ALIAS[normalizedToken];
  }

  if (/^\d+$/.test(normalizedToken)) {
    return DEFAULT_FIELD_BY_INDEX[Number(normalizedToken) - 1] ?? DEFAULT_FIELD_BY_INDEX[index] ?? "";
  }

  return DEFAULT_FIELD_BY_INDEX[index] ?? "";
};

export const getTemplateVariableLabel = (token: string, index: number) => {
  const normalizedToken = normalizeTemplateVariableToken(token);

  if (/^\d+$/.test(normalizedToken)) {
    const alias = VARIABLE_ALIAS_BY_INDEX[Number(normalizedToken) - 1] ?? VARIABLE_ALIAS_BY_INDEX[index];
    return alias ? `{{${normalizedToken}}} · {{${alias}}}` : `{{${normalizedToken}}}`;
  }

  const aliasIndex = Object.entries(VARIABLE_ALIAS_BY_INDEX).find(([, alias]) => alias === normalizedToken)?.[0];
  if (aliasIndex !== undefined) {
    return `{{${Number(aliasIndex) + 1}}} · {{${normalizedToken}}}`;
  }

  return `{{${normalizedToken}}}`;
};

export const applyTemplateVariables = (
  body: string,
  variables: string[],
  values: Record<number, string>,
) => {
  let preview = body;

  variables.forEach((token, index) => {
    const normalizedToken = normalizeTemplateVariableToken(token);
    const value = values[index]?.trim() || formatTemplatePlaceholder(normalizedToken);
    const tokensToReplace = new Set<string>([normalizedToken]);

    if (/^\d+$/.test(normalizedToken)) {
      const alias = VARIABLE_ALIAS_BY_INDEX[Number(normalizedToken) - 1] ?? VARIABLE_ALIAS_BY_INDEX[index];
      if (alias) {
        tokensToReplace.add(alias);
      }
    } else {
      const aliasIndex = Object.entries(VARIABLE_ALIAS_BY_INDEX).find(([, alias]) => alias === normalizedToken)?.[0];
      if (aliasIndex !== undefined) {
        tokensToReplace.add(String(Number(aliasIndex) + 1));
      }
    }

    tokensToReplace.forEach((replacementToken) => {
      preview = preview.replace(
        new RegExp(`\\{\\{\\s*${escapeRegExp(replacementToken)}\\s*\\}\\}`, "g"),
        value,
      );
    });
  });

  return preview;
};
