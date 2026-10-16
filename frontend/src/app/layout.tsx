import type { Metadata } from "next";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { MotionProvider } from "@/components/motion-provider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-family-space-grotesk",
});
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-family-ibm-plex-sans",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-family-ibm-plex-mono",
});
const fontVariables = cn(
  spaceGrotesk.variable,
  ibmPlexSans.variable,
  ibmPlexMono.variable,
);

export const metadata: Metadata = {
  title: "PermitWiseAI",
  description: "PermitWiseAI: permit-to-work, LOTOTO and safety management for industrial sites.",
  applicationName: "PermitWiseAI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={fontVariables}
      data-theme="hazard"
      data-mode="light"
      data-density="normal"
      data-style="standard"
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <MotionProvider>
            {children}
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
