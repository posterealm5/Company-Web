import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public props!: Props;
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  public handleRetry() {
    (this as any).setState({ hasError: false, error: null });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen bg-brand-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white comic-border p-10 shadow-[12px_12px_0px_0px_rgba(239,68,68,1)] text-center space-y-8">
            <div className="w-20 h-20 bg-red-100 flex items-center justify-center mx-auto comic-border border-brand-red">
              <AlertCircle size={40} className="text-brand-red" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-4xl font-black uppercase tracking-tighter italic">Oops! Something went wrong.</h1>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
                A temporary error occurred while loading this page.
              </p>
            </div>

            {isDev && this.state.error && (
              <div className="p-4 bg-gray-50 border-2 border-brand-black text-left overflow-auto max-h-32">
                <p className="font-mono text-[10px] text-brand-red font-bold break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <button 
                onClick={() => this.handleRetry()}
                className="w-full py-4 bg-brand-red text-white font-black uppercase tracking-widest flex items-center justify-center gap-2 comic-border border-white hover:bg-red-700 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
              >
                <RefreshCw size={18} /> Retry
              </button>
              
              <a 
                href="/"
                className="w-full py-4 bg-brand-black text-white font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-800 transition-all"
              >
                <Home size={18} /> Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
