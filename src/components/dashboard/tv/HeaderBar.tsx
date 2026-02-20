import { useState, useEffect } from 'react';
import { LiveIndicator } from '../shared/LiveIndicator';
import logo from '@/assets/logo-green.png';

export const HeaderBar = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedDate = time.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = time.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <header className="h-[60px] flex items-center justify-between px-6 border-b border-white/10 bg-white/5 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <img src={logo} alt="24Help" className="h-8" />
        <div>
          <h1 className="text-sm font-bold tracking-widest uppercase text-white">
            Sales Command Center
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <LiveIndicator />
        <div className="text-right">
          <div className="text-xs text-white/50 uppercase tracking-wider">{formattedDate}</div>
          <div className="text-sm font-mono font-bold text-white tabular-nums">{formattedTime}</div>
        </div>
      </div>
    </header>
  );
};
