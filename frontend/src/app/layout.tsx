import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Baloo_2,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Inter,
  Noto_Sans,
  Sora,
  Source_Serif_4,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { MotionProvider } from "@/components/motion-provider";
import { OAuthCodeRedirect } from "@/components/auth/oauth-code-redirect";

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-family-sora",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-family-inter",
});
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
const baloo2 = Baloo_2({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-family-baloo-2",
});
const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-family-noto-sans",
});
const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-family-source-serif-4",
});

const fontVariables = cn(
  sora.variable,
  inter.variable,
  spaceGrotesk.variable,
  ibmPlexSans.variable,
  ibmPlexMono.variable,
  baloo2.variable,
  notoSans.variable,
  sourceSerif4.variable,
);

export const metadata: Metadata = {
  title: "Permit-to-Work Platform",
  description: "Enterprise Permit-to-Work and safety management platform",
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
            <Suspense fallback={null}>
              <OAuthCodeRedirect />
            </Suspense>
            {children}
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
