import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Voltsense",
  description:
    "Voltsense · despacho de servicio técnico. Gestión de rutas, OT y terreno.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Voltsense",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f3a5f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
