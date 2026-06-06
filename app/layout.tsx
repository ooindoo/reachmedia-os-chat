import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "REACHMEDIA OS",
  description: "Task · Fatture · Time Log per reachmedia.it",
  manifest: "/manifest.json",
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
      <body className={`${geistSans.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
