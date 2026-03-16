const DEFAULT_MANAGED_WHATSAPP_NUMBERS = [
  "whatsapp:+554138911555",
  "whatsapp:+14155238886",
] as const;

export const normalizeWhatsappNumber = (value?: string | null) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
};

export const getManagedWhatsappNumbers = () => {
  const envNumbers = [
    Deno.env.get("TWILIO_PHONE_NUMBER"),
    Deno.env.get("TWILIO_SANDBOX_NUMBER"),
    ...(Deno.env.get("TWILIO_PHONE_NUMBERS")?.split(",") ?? []),
  ];

  return Array.from(
    new Set(
      [...DEFAULT_MANAGED_WHATSAPP_NUMBERS, ...envNumbers]
        .map((number) => normalizeWhatsappNumber(number))
        .filter(Boolean),
    ),
  );
};

export const isManagedWhatsappNumber = (
  value?: string | null,
  managedNumbers = getManagedWhatsappNumbers(),
) => managedNumbers.includes(normalizeWhatsappNumber(value));
