import type { Metadata } from "next";

import { PwaProvider, PwaRuntime } from "@/components/organisms/pwa-runtime";

import "./globals.css";

export const metadata: Metadata = {
  title: "ARES PATH",
  description: "Frontend foundation for the ARES PATH research prototype.",
  icons: {
    icon: "/brand/ares-path-logo.png",
    shortcut: "/brand/ares-path-logo.png",
    apple: "/brand/ares-path-logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PwaProvider>
          <PwaRuntime />
          {children}
        </PwaProvider>
      </body>
    </html>
  );
}
