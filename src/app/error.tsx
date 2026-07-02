'use client';

import { useEffect } from 'react';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('Unhandled runtime error occurred:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-950 relative overflow-hidden text-slate-100">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-red-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-amber-900/10 blur-[120px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 text-center">
        <div className="inline-flex items-center justify-center p-4 bg-red-950/40 border border-red-800/40 rounded-full mb-4 shadow-lg animate-pulse">
          <AlertOctagon className="h-12 w-12 text-red-500" />
        </div>
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-white bg-clip-text bg-gradient-to-r from-red-400 to-amber-400">
          Failed to load the system!
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400 max-w-xs mx-auto">
          An unexpected error occurred while loading the application.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 py-8 px-4 shadow-2xl rounded-2xl sm:px-10 text-center space-y-6">
          <div className="text-left p-4 bg-slate-955/80 border border-slate-800 rounded-lg max-h-48 overflow-y-auto font-mono text-xs text-red-400 select-text">
            <span className="block font-semibold text-slate-400 mb-1">{"// Error message:"}</span>
            {error.message || 'Unknown runtime error occurred.'}
            {error.digest && <span className="block text-slate-500 mt-2">Digest ID: {error.digest}</span>}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => reset()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 cursor-pointer transition-all duration-200"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Try Again</span>
            </button>
            
            <button
              onClick={() => {
                reset();
                router.push('/');
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border border-slate-850 rounded-lg text-sm font-medium text-slate-300 bg-slate-955 hover:bg-slate-900 hover:text-white border-transparent hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 cursor-pointer transition-all duration-200"
            >
              <Home className="h-4 w-4" />
              <span>Go to Home</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
