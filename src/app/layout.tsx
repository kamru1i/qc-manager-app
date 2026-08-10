import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWARegister from "./pwa-register";
import AppUpdater from "@/components/common/AppUpdater";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { NetworkProvider } from "@/providers/NetworkProvider";
import { AppEventBusProvider } from "@/contexts/AppEventBusContext";

import { Toaster } from "sonner";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "QC Manager",
  description: "Secure leave tracking system for office staff",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "QC Manager",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem('theme');
                  var theme = savedTheme || 'dark';
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                  document.documentElement.classList.add('preload');
                  if (document.readyState === 'interactive' || document.readyState === 'complete') {
                    setTimeout(function() {
                      document.documentElement.classList.remove('preload');
                    }, 100);
                  } else {
                    window.addEventListener('DOMContentLoaded', function() {
                      setTimeout(function() {
                        document.documentElement.classList.remove('preload');
                      }, 100);
                    });
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-theme-page-bg text-theme-text-primary">
        <PWARegister />
        <AppUpdater />
        <NetworkProvider>
          <AppEventBusProvider>
            {children}
          </AppEventBusProvider>
        </NetworkProvider>
        <Toaster position="bottom-right" richColors theme="dark" closeButton />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
