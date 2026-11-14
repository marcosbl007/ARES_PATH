import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARES PATH",
  description: "Frontend foundation for the ARES PATH research prototype.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
