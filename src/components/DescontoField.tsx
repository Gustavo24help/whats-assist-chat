import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Percent, DollarSign, AlertTriangle, X, Pencil } from "lucide-react";

interface DescontoFieldProps {
  label: string;
  valorOriginal: number;
  tipoDesconto: string | null;
  descontoValor: number | null;
  descontoPercentual: number | null;
  valorFinal: number | null;
  onApplyDesconto: (tipo: 'valor' | 'percentual', desconto: number) => void;
  onRemoveDesconto: () => void;
}

const formatMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export const DescontoField = ({
  label,
  valorOriginal,
  tipoDesconto,
  descontoValor,
  descontoPercentual,
  valorFinal,
  onApplyDesconto,
  onRemoveDesconto,
}: DescontoFieldProps) => {
  const [showPanel, setShowPanel] = useState(false);
  const [tipo, setTipo] = useState<'valor' | 'percentual'>('percentual');
  const [inputValue, setInputValue] = useState('');

  const hasDesconto = tipoDesconto && (descontoValor || descontoPercentual);

  const handleApply = () => {
    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) return;

    if (tipo === 'percentual' && val > 100) {
      return;
    }

    if (tipo === 'valor' && val >= valorOriginal) {
      if (!window.confirm(`O desconto (${formatMoeda(val)}) é igual ou maior que o valor original (${formatMoeda(valorOriginal)}). Deseja continuar?`)) {
        return;
      }
    }

    if (tipo === 'percentual') {
      const descontoEmReais = (valorOriginal * val) / 100;
      if (descontoEmReais >= valorOriginal) {
        if (!window.confirm(`O desconto (${formatMoeda(descontoEmReais)}) é igual ou maior que o valor original (${formatMoeda(valorOriginal)}). Deseja continuar?`)) {
          return;
        }
      }
    }

    onApplyDesconto(tipo, val);
    setShowPanel(false);
    setInputValue('');
  };

  const handleRemove = () => {
    onRemoveDesconto();
    setShowPanel(false);
    setInputValue('');
  };

  const handleEdit = () => {
    if (tipoDesconto === 'percentual' && descontoPercentual) {
      setTipo('percentual');
      setInputValue(String(descontoPercentual));
    } else if (tipoDesconto === 'valor' && descontoValor) {
      setTipo('valor');
      setInputValue(String(descontoValor));
    }
    setShowPanel(true);
  };

  if (valorOriginal <= 0) return null;

  return (
    <div className="mt-1">
      {hasDesconto && !showPanel ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span className="text-xs text-amber-800 dark:text-amber-200 flex-1">
              Desconto: {tipoDesconto === 'percentual' ? `-${descontoPercentual}%` : ''} ({formatMoeda(descontoValor || 0)})
            </span>
            <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={handleEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-destructive hover:text-destructive" onClick={handleRemove}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-xs font-medium text-foreground pl-1">
            Valor Final: {formatMoeda(valorFinal || 0)}
          </div>
        </div>
      ) : showPanel ? (
        <div className="p-2.5 border rounded-md bg-muted/30 space-y-2">
          <RadioGroup
            value={tipo}
            onValueChange={(v) => setTipo(v as 'valor' | 'percentual')}
            className="flex gap-4"
          >
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="valor" id={`${label}-valor`} />
              <Label htmlFor={`${label}-valor`} className="text-xs cursor-pointer flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Valor (R$)
              </Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="percentual" id={`${label}-percentual`} />
              <Label htmlFor={`${label}-percentual`} className="text-xs cursor-pointer flex items-center gap-1">
                <Percent className="h-3 w-3" /> Percentual (%)
              </Label>
            </div>
          </RadioGroup>
          <div className="flex gap-1.5">
            <Input
              type="number"
              step="0.01"
              min="0"
              max={tipo === 'percentual' ? 100 : undefined}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={tipo === 'percentual' ? 'Ex: 10' : 'Ex: 50.00'}
              className="h-8 text-sm flex-1"
            />
            <Button size="sm" className="h-8 text-xs px-3" onClick={handleApply}>
              Aplicar
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => { setShowPanel(false); setInputValue(''); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {hasDesconto && (
            <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive w-full" onClick={handleRemove}>
              Remover Desconto
            </Button>
          )}
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground hover:text-foreground px-1"
          onClick={() => setShowPanel(true)}
        >
          + Aplicar Desconto
        </Button>
      )}
    </div>
  );
};
