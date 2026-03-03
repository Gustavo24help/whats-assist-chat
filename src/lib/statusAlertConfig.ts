export interface StatusAlertRule {
  status: string;
  maxMinutes: number;
  color: string;
}

export const STATUS_ALERT_CONFIG_KEY = "status_alert_rules";

export const ALERTABLE_STATUSES = [
  "Não foi adiante",
  "Ficha Criada",
  "Contato Inicial",
  "Dúvida Prestador",
  "Orçamento Enviado",
  "Negociação",
  "Visita Técnica",
  "Orçamento Aprovado / Agendamento",
  "Orçamento Não Aprovado",
  "Agendado",
  "Em andamento",
  "Finalizado",
  "Garantia",
  "Perdido"
];

export const DEFAULT_STATUS_ALERT_RULES: StatusAlertRule[] = [];

export const parseStatusAlertRules = (value?: string | null): StatusAlertRule[] => {
  if (!value) return DEFAULT_STATUS_ALERT_RULES;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return DEFAULT_STATUS_ALERT_RULES;

    return parsed
      .filter((rule) => rule && typeof rule.status === "string")
      .map((rule) => ({
        status: rule.status,
        maxMinutes: Number(rule.maxMinutes) > 0
          ? Number(rule.maxMinutes)
          : Number(rule.maxHours) > 0
            ? Number(rule.maxHours) * 60
            : 60,
        color: typeof rule.color === "string" && rule.color.startsWith("#") ? rule.color : "#DC2626",
      }));
  } catch {
    return DEFAULT_STATUS_ALERT_RULES;
  }
};


const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((c) => `${c}${c}`).join("")
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return { r: 220, g: 38, b: 38 };
  }

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }: { r: number; g: number; b: number }) =>
  `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("")}`;

const interpolateHex = (from: string, to: string, progress: number) => {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const p = clamp(progress, 0, 1);

  return rgbToHex({
    r: start.r + (end.r - start.r) * p,
    g: start.g + (end.g - start.g) * p,
    b: start.b + (end.b - start.b) * p,
  });
};

export const getEscalatedAlertColor = (minutesInStatus: number, rule: StatusAlertRule) => {
  if (minutesInStatus <= rule.maxMinutes) return null;

  const overRatio = (minutesInStatus - rule.maxMinutes) / rule.maxMinutes;
  const progress = clamp(overRatio, 0, 1);

  // 0% excedido = laranja forte, 100% excedido (2x limite) = cor final configurada
  return interpolateHex("#F97316", rule.color, progress);
};
