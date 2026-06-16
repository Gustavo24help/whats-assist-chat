// Gera as variantes possíveis do telefone BR (com e sem o 9º dígito do celular),
// no formato whatsapp:+55DDDxxxxxxxx. Nesta conta a Twilio entrega DDD 41 SEM o 9.
export function variantesTelefone(raw: string): string[] {
  let d = String(raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2); // tira DDI
  if (d.length < 10) return [];                              // inválido
  const ddd = d.slice(0, 2);
  let sub = d.slice(2);
  if (sub.length === 9 && sub[0] === "9") sub = sub.slice(1); // base sem o 9
  const sem9 = `whatsapp:+55${ddd}${sub}`;
  const com9 = /^[6-9]/.test(sub) ? `whatsapp:+55${ddd}9${sub}` : sem9;
  return Array.from(new Set([sem9, com9])); // [0]=sem9 (formato Twilio), [1]=com9
}
