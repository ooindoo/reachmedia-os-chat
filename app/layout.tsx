import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Providers from "@/components/Providers";
import "./globals.css";

const inter = localFont({
  src: "./fonts/inter.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const bebas = localFont({
  src: "./fonts/bebas-neue.woff2",
  variable: "--font-bebas",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "chat.reachmedia.it | Ardit N",
  description: "Task · Fatture · Time Log per reachmedia.it",
  manifest: "/manifest.json?v=3",
  icons: {
    icon: { url: "/favicon.svg", type: "image/svg+xml" },
    // apple-touch-icon and icon.png auto-served from app/apple-icon.tsx + app/icon.tsx
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RM OS",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={`${inter.variable} ${bebas.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
