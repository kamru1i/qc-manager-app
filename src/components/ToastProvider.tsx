'use client';

import { Toaster } from 'react-hot-toast';

export const ToastProvider = () => {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#0f172a', // Slate 900
          color: '#f1f5f9', // Slate 100
          border: '1px solid #1e293b', // Slate 800
          borderRadius: '12px',
          fontSize: '13px',
          padding: '12px 16px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
        },
        success: {
          iconTheme: {
            primary: '#10b981', // Emerald 500
            secondary: '#0f172a',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444', // Red 500
            secondary: '#0f172a',
          },
        },
      }}
    />
  );
};
