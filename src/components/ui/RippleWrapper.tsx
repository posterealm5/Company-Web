import { motion } from 'motion/react';
import { ReactNode } from 'react';

interface RippleWrapperProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  disabled?: boolean;
}

export const RippleWrapper = ({ children, className = '', delay = 2, disabled = false }: RippleWrapperProps) => {
  if (disabled) return <div className={className}>{children}</div>;

  return (
    <motion.div 
      className={`relative inline-block ${className}`}
      initial="rest"
      whileHover="hover"
      animate="rest"
    >
      <motion.div
        className="absolute -inset-1 border-4 border-brand-red pointer-events-none z-0"
        variants={{
          rest: { opacity: 0, scale: 1 },
          hover: {
            scale: [1, 1.2],
            opacity: [0.8, 0],
            transition: {
              delay,
              duration: 0.8,
              repeat: Infinity,
              ease: "easeOut"
            }
          }
        }}
      />
      <motion.div
        className="absolute -inset-2 border-2 border-brand-red/50 pointer-events-none z-0"
        variants={{
          rest: { opacity: 0, scale: 1 },
          hover: {
            scale: [1, 1.3],
            opacity: [0.6, 0],
            transition: {
              delay: delay + 0.3,
              duration: 0.8,
              repeat: Infinity,
              ease: "easeOut"
            }
          }
        }}
      />
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};
