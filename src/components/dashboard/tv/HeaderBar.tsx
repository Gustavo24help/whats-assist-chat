import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LiveIndicator } from '../shared/LiveIndicator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo-green.png';

interface HeaderBarProps {
  filtros: {
    periodo: string;
    comparacao: string;
    apenasUteis: boolean;
    prestadorId: string;
    categoriaId: string;
  };
  onFiltrosChange: (filtros: any) => void;
  onOpenMetas: () => void;
}

export const HeaderBar = ({ filtros, onFiltrosChange, onOpenMetas }: HeaderBarProps) => {
  const [time, setTime] = useState(new Date());
  const [prestadores, setPrestadores] = useState<{ cpf: string; nome: string }[]>([]);
  const [categorias, setCategorias] = useState<{ id: number; nome: string }[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.from('prestadores').select('cpf, nome').then(({ data }) => {
      if (data) setPrestadores(data);
    });
    supabase.from('categorias').select('id, nome').then(({ data }) => {
      if (data) setCategorias(data);
    });
  }, []);

  const dateStr = time.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const timeStr = time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <header className="px-6 py-3 flex items-center gap-4 border-b border-white/10 bg-white/5 backdrop-blur-xl flex-wrap">
      <div className="flex items-center gap-3 mr-4">
        <img src={logo} alt="24Help" className="h-8" />
        <span className="text-[11px] font-bold tracking-[2px] uppercase text-white/40 hidden lg:inline">
          Centro de Comando de Vendas
        </span>
      </div>

      <LiveIndicator />

      <motion.div
        className="text-xs font-mono text-white/50 tabular-nums"
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {dateStr} {timeStr}
      </motion.div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filtros.periodo} onValueChange={(v) => onFiltrosChange({ ...filtros, periodo: v })}>
          <SelectTrigger className="h-8 w-[130px] bg-white/5 border-white/10 text-white/80 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="ontem">Ontem</SelectItem>
            <SelectItem value="7dias">Últimos 7 dias</SelectItem>
            <SelectItem value="30dias">Últimos 30 dias</SelectItem>
            <SelectItem value="mes_atual">Mês Atual</SelectItem>
            <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtros.comparacao} onValueChange={(v) => onFiltrosChange({ ...filtros, comparacao: v })}>
          <SelectTrigger className="h-8 w-[160px] bg-white/5 border-white/10 text-white/80 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ontem">vs Ontem</SelectItem>
            <SelectItem value="semana_passada">vs Semana Passada</SelectItem>
            <SelectItem value="mes_anterior">vs Mês Anterior</SelectItem>
            <SelectItem value="mesmo_dia_mes">vs Mesmo Dia Mês Ant.</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 px-2">
          <Switch
            checked={filtros.apenasUteis}
            onCheckedChange={(v) => onFiltrosChange({ ...filtros, apenasUteis: v })}
            className="scale-75"
          />
          <span className="text-[10px] text-white/50">Dias úteis</span>
        </div>

        <Select value={filtros.prestadorId} onValueChange={(v) => onFiltrosChange({ ...filtros, prestadorId: v })}>
          <SelectTrigger className="h-8 w-[150px] bg-white/5 border-white/10 text-white/80 text-xs">
            <SelectValue placeholder="Todos Prestadores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Prestadores</SelectItem>
            {prestadores.map((p) => (
              <SelectItem key={p.cpf} value={p.cpf}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtros.categoriaId} onValueChange={(v) => onFiltrosChange({ ...filtros, categoriaId: v })}>
          <SelectTrigger className="h-8 w-[150px] bg-white/5 border-white/10 text-white/80 text-xs">
            <SelectValue placeholder="Todas Categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as Categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={String(c.id)} value={String(c.id)}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className="h-8 bg-white/5 border-white/10 text-white/80 text-xs hover:bg-white/10"
          onClick={onOpenMetas}
        >
          🎯 Metas
        </Button>
      </div>
    </header>
  );
};
