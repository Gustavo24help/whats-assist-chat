import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Eye, RefreshCw, Loader2, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import { valorPorExtenso } from "@/lib/valorPorExtenso";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReciboGeneratorProps {
  fichaId: string;
  nomeCliente: string;
  cpfCliente: string | null;
  valorTotal: number;
  descricao: string | null;
  pagamentoRealizado: boolean;
  statusFicha: string;
  telefoneCliente: string;
  reciboUrl: string | null;
  onReciboGenerated: (url: string) => void;
}

// Cores
const VERDE_24HELP = [0, 100, 60]; // RGB verde escuro
const CINZA_ESCURO = [60, 60, 60];
const CINZA_CLARO = [120, 120, 120];

export const ReciboGenerator = ({
  fichaId,
  nomeCliente,
  cpfCliente,
  valorTotal,
  descricao,
  pagamentoRealizado,
  statusFicha,
  telefoneCliente,
  reciboUrl,
  onReciboGenerated,
}: ReciboGeneratorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

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
    let y = 25;

    // ========== HEADER ==========
    
    // Logo 24help (texto estilizado como fallback)
    doc.setTextColor(VERDE_24HELP[0], VERDE_24HELP[1], VERDE_24HELP[2]);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('24help', margin, y);
    
    // Barra verde com "RECIBO"
    const barraY = y - 8;
    const barraHeight = 12;
    const barraWidth = 50;
    doc.setFillColor(VERDE_24HELP[0], VERDE_24HELP[1], VERDE_24HELP[2]);
    doc.rect(pageWidth - margin - barraWidth, barraY, barraWidth, barraHeight, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBO', pageWidth - margin - barraWidth / 2, barraY + 8, { align: 'center' });
    
    y += 15;

    // ========== DADOS DA EMPRESA E VALOR ==========
    
    // Empresa (lado esquerdo)
    doc.setTextColor(CINZA_ESCURO[0], CINZA_ESCURO[1], CINZA_ESCURO[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('24HELP INTERMEDIACAO E GESTAO DE SERVICOS', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('CNPJ: 85.016.434/0001-32', margin, y);
    
    // Valor (lado direito, destacado)
    doc.setTextColor(VERDE_24HELP[0], VERDE_24HELP[1], VERDE_24HELP[2]);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text(formatarValor(valorTotal), pageWidth - margin, y - 3, { align: 'right' });
    
    y += 12;
    
    // Valor por extenso
    doc.setTextColor(CINZA_CLARO[0], CINZA_CLARO[1], CINZA_CLARO[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    const extenso = valorPorExtenso(valorTotal);
    doc.text(extenso, pageWidth - margin, y, { align: 'right' });
    
    y += 20;

    // ========== LINHA DIVISÓRIA ==========
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 15;

    // ========== RECEBEMOS DE ==========
    doc.setTextColor(CINZA_ESCURO[0], CINZA_ESCURO[1], CINZA_ESCURO[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Recebemos de:', margin, y);
    
    // Selo PAGO (somente se ficha finalizada E pagamento realizado)
    if (statusFicha === 'Finalizado' && pagamentoRealizado) {
      const seloX = pageWidth - margin - 25;
      const seloY = y - 5;
      
      // Círculo do selo
      doc.setDrawColor(VERDE_24HELP[0], VERDE_24HELP[1], VERDE_24HELP[2]);
      doc.setLineWidth(2);
      doc.circle(seloX, seloY + 5, 12, 'S');
      
      // Texto PAGO
      doc.setTextColor(VERDE_24HELP[0], VERDE_24HELP[1], VERDE_24HELP[2]);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('PAGO', seloX, seloY + 7, { align: 'center' });
    }
    
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(nomeCliente || 'Cliente', margin, y);
    
    y += 8;
    
    // CPF/CNPJ do cliente
    if (cpfCliente) {
      doc.setFontSize(9);
      doc.setTextColor(CINZA_CLARO[0], CINZA_CLARO[1], CINZA_CLARO[2]);
      doc.text(`CPF/CNPJ: ${cpfCliente}`, margin, y);
      y += 10;
    }
    
    y += 5;

    // ========== REFERENTE A ==========
    doc.setTextColor(CINZA_ESCURO[0], CINZA_ESCURO[1], CINZA_ESCURO[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Referente a:', margin, y);
    y += 6;
    
    // Descrição limpa
    const descricaoLimpa = descricao 
      ? await limparDescricaoComIA(descricao)
      : 'Serviço realizado conforme solicitação';
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(descricaoLimpa, pageWidth - 2 * margin);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 10;

    // ========== DATA ==========
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    doc.setFont('helvetica', 'bold');
    doc.text('Data:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(dataAtual, margin + 12, y);
    
    
    y += 15;

    // ========== RODAPÉ ==========
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    
    doc.setTextColor(CINZA_CLARO[0], CINZA_CLARO[1], CINZA_CLARO[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('24HELP INTERMEDIACAO E GESTAO DE SERVIÇOS LTDA', pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.text('CNPJ: 85.016.434/0001-32', pageWidth / 2, y, { align: 'center' });

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

  // Baixar usando fetch + blob para evitar bloqueio do Chrome
  const handleDownloadRecibo = async () => {
    if (!reciboUrl) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(reciboUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `recibo_${fichaId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      toast.success('Download iniciado!');
    } catch (error) {
      console.error('Erro ao baixar:', error);
      toast.error('Erro ao baixar recibo');
    } finally {
      setIsDownloading(false);
    }
  };

  // Ver - carrega PDF e mostra em modal (contorna bloqueio de extensões)
  const handleVerRecibo = async () => {
    if (!reciboUrl) return;
    
    setIsLoadingPreview(true);
    try {
      // Fetch interno não é bloqueado por extensões
      const response = await fetch(reciboUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      setPreviewUrl(blobUrl);
      setShowPreview(true);
    } catch (error) {
      console.error('Erro ao carregar preview:', error);
      toast.error('Erro ao visualizar recibo');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleClosePreview = (open: boolean) => {
    setShowPreview(open);
    if (!open && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  return (
    <div className="space-y-3">
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
        <div className="space-y-2">
          {/* Grid 2x2 para Ver e Baixar */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleVerRecibo}
              variant="outline"
              disabled={isLoadingPreview}
              className="w-full"
            >
              {isLoadingPreview ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              Ver
            </Button>
            
            <Button
              onClick={handleDownloadRecibo}
              variant="outline"
              disabled={isDownloading}
              className="w-full"
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Baixar
            </Button>
          </div>
          
          {/* Enviar - Botão principal */}
          <Button
            onClick={handleEnviarRecibo}
            disabled={isSending}
            className="w-full"
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
          
          {/* Regenerar - Menos destaque */}
          <Button
            onClick={handleGerarRecibo}
            disabled={isGenerating}
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
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

      {/* Modal de Preview do PDF */}
      <Dialog open={showPreview} onOpenChange={handleClosePreview}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Recibo - {fichaId}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewUrl && (
              <iframe 
                src={previewUrl}
                className="w-full h-full border-0 rounded"
                title="Preview do Recibo"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
