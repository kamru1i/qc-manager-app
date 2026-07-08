'use client';

import { useState, useEffect, useCallback } from 'react';

export const useQuotesTheme = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Theme configuration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      let initialTheme: 'dark' | 'light' = 'dark';
      
      if (savedTheme === 'dark' || savedTheme === 'light') {
        initialTheme = savedTheme;
      } else {
        // System preference detection
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        initialTheme = prefersDark ? 'dark' : 'light';
      }

      setTheme(initialTheme);
      if (initialTheme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }

      // Live listener for system theme preference changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        // Only change theme if user hasn't explicitly set a preference in localStorage
        if (!localStorage.getItem('theme')) {
          const newTheme = e.matches ? 'dark' : 'light';
          setTheme(newTheme);
          if (newTheme === 'light') {
            document.documentElement.classList.remove('dark');
          } else {
            document.documentElement.classList.add('dark');
          }
        }
      };

      // Use the modern API and fallback for older environments if needed
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemThemeChange);
      } else {
        // Fallback for older browsers
        (mediaQuery as any).addListener(handleSystemThemeChange);
      }

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleSystemThemeChange);
        } else {
          (mediaQuery as any).removeListener(handleSystemThemeChange);
        }
      };
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleGlobalThemeChange = (e: Event) => {
        const nextTheme = (e as CustomEvent).detail;
        setTheme(nextTheme);
      };
      window.addEventListener('theme-change', handleGlobalThemeChange);
      return () => {
        window.removeEventListener('theme-change', handleGlobalThemeChange);
      };
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', nextTheme);
    }
    if (nextTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [theme]);

  return { theme, toggleTheme };
};
