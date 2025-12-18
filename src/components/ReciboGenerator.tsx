import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Send, Eye, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import { valorPorExtenso } from "@/lib/valorPorExtenso";
import logoBase64 from "@/assets/logo-24help.png";

interface ReciboGeneratorProps {
  fichaId: string;
  nomeCliente: string;
  cpfCliente: string | null;
  valorTotal: number;
  descricao: string | null;
  pagamentoRealizado: boolean;
  telefoneCliente: string;
  reciboUrl: string | null;
  onReciboGenerated: (url: string) => void;
}

export const ReciboGenerator = ({
  fichaId,
  nomeCliente,
  cpfCliente,
  valorTotal,
  descricao,
  pagamentoRealizado,
  telefoneCliente,
  reciboUrl,
  onReciboGenerated,
}: ReciboGeneratorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const limparDescricaoComIA = async (desc: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('clean-description', {
        body: { descricao: desc }
      });
      
      if (error) {
        console.error('Erro ao limpar descrição:', error);
        return desc;
      }
      
      return data?.descricaoLimpa || desc;
    } catch (err) {
      console.error('Erro na chamada da função:', err);
      return desc;
    }
  };

  const formatarValor = (valor: number): string => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const gerarReciboPDF = async (): Promise<Blob> => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    // Carregar logo como base64
    try {
      const img = new Image();
      img.src = logoBase64;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      
      // Logo centralizado
      const logoWidth = 50;
      const logoHeight = 20;
      doc.addImage(img, 'PNG', (pageWidth - logoWidth) / 2, y, logoWidth, logoHeight);
      y += logoHeight + 10;
    } catch (err) {
      console.warn('Não foi possível carregar o logo:', err);
      y += 10;
    }

    // Linha verde com "RECIBO"
    doc.setFillColor(34, 139, 34); // Verde
    doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBO', pageWidth - margin - 5, y + 7, { align: 'right' });
    y += 15;

    // Dados da empresa
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('24HELP INTERMEDIACAO E GESTAO DE SERVICOS', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('CNPJ: 85.016.434/0001-32', margin, y);
    y += 15;

    // Valor em destaque (lado direito)
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 139, 34);
    doc.text(formatarValor(valorTotal), pageWidth - margin, y, { align: 'right' });
    y += 8;

    // Valor por extenso
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'italic');
    const extenso = valorPorExtenso(valorTotal);
    doc.text(`(${extenso})`, pageWidth - margin, y, { align: 'right' });
    y += 15;

    // Selo PAGO se pagamento realizado
    if (pagamentoRealizado) {
      doc.setFontSize(20);
      doc.setTextColor(34, 139, 34);
      doc.setFont('helvetica', 'bold');
      doc.text('PAGO', pageWidth - margin - 30, y - 10);
      // Desenhar círculo ao redor
      doc.setDrawColor(34, 139, 34);
      doc.setLineWidth(1);
      doc.circle(pageWidth - margin - 20, y - 15, 15, 'S');
    }

    // Recebemos de
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Recebemos de:', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(nomeCliente || 'Cliente', margin, y);
    y += 10;

    // CPF/CNPJ
    if (cpfCliente) {
      doc.setFont('helvetica', 'bold');
      doc.text('CPF/CNPJ:', margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.text(cpfCliente, margin, y);
      y += 10;
    }

    // Referente a (descrição limpa)
    doc.setFont('helvetica', 'bold');
    doc.text('Referente a:', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    
    // Limpar descrição com IA
    const descricaoLimpa = descricao 
      ? await limparDescricaoComIA(descricao)
      : 'Serviço realizado';
    
    // Quebrar texto se muito longo
    const lines = doc.splitTextToSize(descricaoLimpa, pageWidth - 2 * margin);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 15;

    // Data
    const dataAtual = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    doc.setFont('helvetica', 'normal');
    doc.text(`Rio de Janeiro, ${dataAtual}`, margin, y);

    return doc.output('blob');
  };

  const handleGerarRecibo = async () => {
    setIsGenerating(true);
    
    try {
      toast.info('Gerando recibo...');
      
      // Gerar PDF
      const pdfBlob = await gerarReciboPDF();
      
      // Nome único do arquivo
      const fileName = `recibo_${fichaId}_${Date.now()}.pdf`;
      
      // Upload para storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(`recibos/${fileName}`, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });
      
      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        toast.error('Erro ao salvar recibo');
        return;
      }
      
      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(`recibos/${fileName}`);
      
      const publicUrl = urlData.publicUrl;
      
      // Salvar URL na ficha
      const { error: updateError } = await supabase
        .from('fichas_de_servico')
        .update({ recibo_url: publicUrl })
        .eq('id', fichaId);
      
      if (updateError) {
        console.error('Erro ao atualizar ficha:', updateError);
        toast.error('Erro ao salvar URL do recibo');
        return;
      }
      
      onReciboGenerated(publicUrl);
      toast.success('Recibo gerado com sucesso!');
      
    } catch (error) {
      console.error('Erro ao gerar recibo:', error);
      toast.error('Erro ao gerar recibo');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEnviarRecibo = async () => {
    if (!reciboUrl) {
      toast.error('Gere o recibo primeiro');
      return;
    }
    
    setIsSending(true);
    
    try {
      const mensagem = 'Olá! Segue o recibo do serviço realizado. 📄';
      
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          to: telefoneCliente,
          message: mensagem,
          mediaUrl: reciboUrl
        }
      });
      
      if (error) {
        console.error('Erro ao enviar:', error);
        toast.error('Erro ao enviar recibo');
        return;
      }
      
      toast.success('Recibo enviado ao cliente!');
      
    } catch (error) {
      console.error('Erro ao enviar recibo:', error);
      toast.error('Erro ao enviar recibo');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerRecibo = () => {
    if (reciboUrl) {
      window.open(reciboUrl, '_blank');
    }
  };

  return (
    <div className="mt-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-5 w-5 text-primary" />
        <span className="font-medium text-sm">Recibo de Serviço</span>
      </div>
      
      {!reciboUrl ? (
        <Button
          onClick={handleGerarRecibo}
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gerando recibo...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Gerar Recibo
            </>
          )}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              onClick={handleVerRecibo}
              variant="outline"
              className="flex-1"
            >
              <Eye className="mr-2 h-4 w-4" />
              Ver Recibo
            </Button>
            
            <Button
              onClick={handleEnviarRecibo}
              disabled={isSending}
              className="flex-1"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar ao Cliente
                </>
              )}
            </Button>
          </div>
          
          <Button
            onClick={handleGerarRecibo}
            disabled={isGenerating}
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Regenerando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-3 w-3" />
                Regenerar Recibo
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
