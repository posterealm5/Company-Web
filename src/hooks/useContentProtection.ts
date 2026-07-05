import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useContentProtection() {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');

  useEffect(() => {
    if (isAdminPage) return;

    // 1. Disable contextmenu (right click on desktop, long-press contextmenu on mobile)
    const handleContextMenu = (e: MouseEvent) => {
      // Find the element target
      const target = e.target as HTMLElement;
      
      // Do not block context menu on standard input fields or textareas to maintain accessibility
      const isInput = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable;
        
      if (!isInput) {
        e.preventDefault();
      }
    };

    // 5. Block developer shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we are inside a text input where normal typing happens
      const target = e.target as HTMLElement;
      const isInput = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable;

      // F12 key
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }

      // Ctrl + Shift + I, J, C
      const isDevToolsCombo = 
        e.ctrlKey && 
        e.shiftKey && 
        (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c' || e.code === 'KeyI' || e.code === 'KeyJ' || e.code === 'KeyC');
        
      if (isDevToolsCombo) {
        e.preventDefault();
        return;
      }

      // Ctrl + U (View Source)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'U' || e.key === 'u' || e.code === 'KeyU')) {
        e.preventDefault();
        return;
      }

      // Ctrl + S (Save Page)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'S' || e.key === 's' || e.code === 'KeyS')) {
        e.preventDefault();
        return;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAdminPage]);
}
