import React, { useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface WidgetDimensions {
  width: number;
  height: number;
  /** Suggested main value font size (height * 0.30) */
  valueFontSize: number;
  /** Suggested label font size (height * 0.11) */
  labelFontSize: number;
  /** Suggested sub-text font size (height * 0.08) */
  subFontSize: number;
  /** Suggested icon size (height * 0.18) */
  iconSize: number;
  /** Suggested padding (min(width,height) * 0.08) */
  padding: number;
}

interface Props {
  children: (dims: WidgetDimensions) => ReactNode;
  className?: string;
  neonBorder?: string;
}

export function TVAutoSizeWidget({ children, className, neonBorder = 'border-cyan-500/15' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<WidgetDimensions>({
    width: 300, height: 150, valueFontSize: 45, labelFontSize: 16.5,
    subFontSize: 12, iconSize: 27, padding: 12,
  });

  const recalc = useCallback(() => {
    if (!ref.current) return;
    const w = ref.current.clientWidth;
    const h = ref.current.clientHeight;
    const minDim = Math.min(w, h);
    setDims({
      width: w,
      height: h,
      valueFontSize: Math.max(14, Math.min(h * 0.30, w * 0.15)),
      labelFontSize: Math.max(9, Math.min(h * 0.11, w * 0.055)),
      subFontSize: Math.max(8, Math.min(h * 0.08, w * 0.04)),
      iconSize: Math.max(12, Math.min(h * 0.18, w * 0.08)),
      padding: Math.max(4, minDim * 0.06),
    });
  }, []);

  useEffect(() => {
    recalc();
    const ro = new ResizeObserver(recalc);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [recalc]);

  return (
    <div
      ref={ref}
      className={cn(
        'w-full h-full bg-white border border-[#E2E8F0] rounded-xl',
        'shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden',
        className,
      )}
    >
      {children(dims)}
    </div>
  );
}
