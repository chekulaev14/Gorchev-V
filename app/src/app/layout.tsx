import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP",
  description: "Управление производственными процессами",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <Toaster position="top-right" richColors closeButton duration={4000} />
        </ThemeProvider>
      </body>
    </html>
  );
}
