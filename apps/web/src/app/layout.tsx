import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
