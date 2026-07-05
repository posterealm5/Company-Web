import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

export const Notification = () => {
  const { showNotification, notificationState } = useNotification();
  const { title, message, type } = notificationState;

  return (
    <AnimatePresence>
      {showNotification && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 20, x: '-50%' }}
          className="fixed bottom-10 left-1/2 z-[100] w-auto min-w-[300px] max-w-[90vw]"
        >
          <div className="bg-brand-black text-white px-6 py-4 comic-border border-white flex items-center gap-4 shadow-2xl">
            {type === 'error' ? (
              <AlertCircle className="text-brand-red flex-shrink-0" size={20} />
            ) : (
              <CheckCircle className="text-brand-red flex-shrink-0" size={20} />
            )}
            <div className="flex flex-col text-left">
              <p className="font-display uppercase tracking-widest text-sm font-black leading-tight">
                {title}
              </p>
              {message && (
                <p className="text-xs text-gray-400 font-medium mt-0.5 leading-normal font-sans">
                  {message}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
