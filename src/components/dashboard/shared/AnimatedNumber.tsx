import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export const AnimatedNumber = ({
  value,
  duration = 1.5,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: AnimatedNumberProps) => {
  const spring = useSpring(0, { duration: duration * 1000, bounce: 0 });
  const display = useTransform(spring, (v) => {
    const formatted = decimals > 0
      ? v.toFixed(decimals)
      : Math.round(v).toLocaleString('pt-BR');
    return `${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span className={className}>{display}</motion.span>;
};
