import { motion } from 'framer-motion';

interface LiveIndicatorProps {
  className?: string;
}

export const LiveIndicator = ({ className = '' }: LiveIndicatorProps) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <motion.div
      className="w-2.5 h-2.5 rounded-full bg-red-500"
      animate={{ opacity: [1, 0.4, 1], scale: [1, 1.3, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    />
    <span className="text-xs font-bold tracking-widest uppercase text-red-400">Live</span>
  </div>
);
