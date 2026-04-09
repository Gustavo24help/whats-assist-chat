import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface FichaWhatsAppProps {
  servico: string;
  data: string;
  hora: string;
  horaPrestador?: string;
  prestador: string;
  cliente: string;
  endereco: string;
  observacoes?: string;
  telefone?: string;
  especial?: boolean;
}

type Visao = "cliente" | "prestador";

function buildLines(props: FichaWhatsAppProps, visao: Visao): string[] {
  const { servico, data, hora, horaPrestador, prestador, cliente, endereco, observacoes, telefone, especial } = props;
  const horaExibida = visao === "prestador" && horaPrestador ? horaPrestador : hora;

  const lines: string[] = [
    "• *Ficha de Serviço*",
    `• Serviço: ${servico}`,
    `• Data: ${data}`,
    `• Hora: ${horaExibida}`,
  ];

  if (visao === "cliente") {
    lines.push(`• Prestador: ${prestador}`);
    if (especial && telefone) lines.push(`• Telefone: ${telefone}`);
  } else {
    lines.push(`• Cliente: ${cliente}`);
    if (especial && telefone) lines.push(`• Telefone: ${telefone}`);
  }

  lines.push(`• Endereço: ${endereco}`);
  if (observacoes) lines.push(`• Observações: ${observacoes}`);

  if (especial) {
    lines.push("");
    if (visao === "cliente") {
      lines.push(
        "• ⚠️ Este agendamento é em horário especial. Para comunicações urgentes com o prestador, você pode enviar mensagem diretamente pelo WhatsApp.",
        "",
        "• Importante: Qualquer acordo realizado diretamente com o prestador, sem conhecimento da 24help, não possui garantia. Caso o escopo do serviço mude, comunique-nos imediatamente."
      );
    } else {
      lines.push(
        "• ⚠️ Este agendamento é em sua janela de horário especial. Para comunicações urgentes com o cliente, você pode enviar mensagem diretamente pelo WhatsApp.",
        "",
        "• Confiamos em você! Estamos compartilhando o telefone do cliente para facilitar a comunicação. Lembre-se: qualquer alteração no escopo do serviço deve ser aprovada formalmente pela 24help. Não deixe de nos comunicar sobre mudanças no combinado."
      );
    }
  }

  return lines;
}

function copyText(lines: string[]): string {
  return lines.map(l => l.replace(/\*/g, "")).join("\n");
}

export default function FichaWhatsApp(props: FichaWhatsAppProps) {
  const [visao, setVisao] = useState<Visao>("cliente");
  const [copiado, setCopiado] = useState(false);

  const lines = buildLines(props, visao);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText(lines));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-3">
      {/* Toggle buttons */}
      <div className="flex gap-2">
        {(["cliente", "prestador"] as Visao[]).map((v) => (
          <button
            key={v}
            onClick={() => setVisao(v)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              visao === v
                ? "bg-[#25D366] text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Ficha de Serviço - {v === "cliente" ? "Cliente" : "Prestador"}
          </button>
        ))}
      </div>

      {/* WhatsApp-style card */}
      <div className="bg-white border border-[#e0e0e0] rounded-lg shadow-sm">
        {/* Copy button row */}
        <div className="flex justify-end px-3 pt-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-[#f0f0f0] hover:bg-[#e0e0e0] text-[#555] transition-colors"
          >
            {copiado ? (
              <>
                <Check className="h-3 w-3" /> Copiado!
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copiar
              </>
            )}
          </button>
        </div>

        {/* Message content */}
        <div className="px-4 pb-4 pt-1 text-[14px] leading-relaxed text-[#111] font-[system-ui] whitespace-pre-wrap">
          {lines.map((line, i) =>
            line === "" ? (
              <br key={i} />
            ) : (
              <div key={i}>
                {line.split(/(\*[^*]+\*)/).map((seg, j) =>
                  seg.startsWith("*") && seg.endsWith("*") ? (
                    <strong key={j}>{seg.slice(1, -1)}</strong>
                  ) : (
                    <span key={j}>{seg}</span>
                  )
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Demo wrapper ── */
export function FichaWhatsAppDemo() {
  return (
    <div className="p-6 bg-[#efeae2] min-h-screen flex items-start justify-center">
      <FichaWhatsApp
        servico="Troca de resistência do chuveiro"
        data="15/04/2026"
        hora="08:00 – 10:00"
        horaPrestador="08:00 – 09:00"
        prestador="Carlos Henrique"
        cliente="Maria Silva"
        endereco="Rua das Flores 123, Apto 4B, Centro – São Paulo/SP"
        observacoes="Levar chave de fenda Phillips. Portaria libera após 07:30."
        telefone="(11) 99999-0000"
        especial={true}
      />
    </div>
  );
}
