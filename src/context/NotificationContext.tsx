import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';

export type NotificationType = 'success' | 'error';

interface NotificationState {
  isOpen: boolean;
  title: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  showNotification: boolean;
  notificationMessage: string;
  triggerNotification: (title: string, message?: string, type?: NotificationType) => void;
  notificationState: NotificationState;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<NotificationState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success',
  });

  const lastToastRef = useRef<{ title: string; message: string; type: NotificationType; timestamp: number } | null>(null);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  const closeNotification = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const triggerNotification = useCallback((title: string, message: string = '', type: NotificationType = 'success') => {
    const now = Date.now();
    const last = lastToastRef.current;

    if (
      last &&
      last.title === title &&
      last.message === message &&
      last.type === type &&
      now - last.timestamp < 2000
    ) {
      // Refresh the timestamp and reset the dismiss timer without re-triggering entrance animation
      lastToastRef.current.timestamp = now;
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      dismissTimerRef.current = setTimeout(closeNotification, 3000);
      return;
    }

    lastToastRef.current = { title, message, type, timestamp: now };

    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }

    setState({
      isOpen: true,
      title,
      message,
      type,
    });

    dismissTimerRef.current = setTimeout(closeNotification, 3000);
  }, [closeNotification]);

  const contextValue = useMemo(() => ({
    showNotification: state.isOpen,
    notificationMessage: state.title,
    triggerNotification,
    notificationState: state,
  }), [state, triggerNotification]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};
