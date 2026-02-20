import { motion } from 'framer-motion';
import { mockData } from '../shared/mockData';

export const LiveTicker = () => {
  const items = mockData.ticker;
  const text = items.join('  |  ');

  return (
    <div className="h-12 flex items-center overflow-hidden border-t border-red-500/20 bg-red-500/5">
      <motion.div
        className="whitespace-nowrap text-sm font-medium text-white/70"
        animate={{ x: ['100%', '-100%'] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      >
        {text}  |  {text}
      </motion.div>
    </div>
  );
};
