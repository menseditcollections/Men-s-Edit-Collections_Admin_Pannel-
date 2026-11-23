import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: "Men's Edit Collections — Inventory",
  description: "Professional inventory & stock management for Men's Edit Collections",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{if(localStorage.getItem("mec-theme")==="dark"){var e=document.documentElement;e.classList.add("dark");e.style.colorScheme="dark";}}catch(_){}})()`}
        </Script>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
