import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/kokonutui/promise-toast";
import { PreferencesProvider } from "@/lib/context/preferences";

export const metadata: Metadata = {
  title: "Finkhy",
  description: "Dashboard financiero personal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased">
        <TooltipProvider>
          <ToastProvider>
            <PreferencesProvider>
              <Navbar />
              <main className="mx-auto max-w-screen-2xl px-6 pt-20 pb-10">
                {children}
              </main>
            </PreferencesProvider>
          </ToastProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
