import type { Metadata } from "next";
import { Orbitron, Sora } from "next/font/google";
import "./globals.css";
import { SkyBackground } from "@/components/sky-background";
import { cn } from "@/lib/utils";

// Self-hosted at build time; each exposes a CSS variable used in globals.css.
const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-orbitron" });

export const metadata: Metadata = {
  title: "Waypoints",
  description: "Prioritise your interests and projects",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", sora.variable, orbitron.variable)}>
      <body>
        <SkyBackground />
        {children}
      </body>
    </html>
  );
}
