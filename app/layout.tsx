import type { Metadata } from "next";
import { Toaster } from "sonner";

import "./globals.css";
import { AppInit } from "@/components/providers/app-init";
import { ClerkProviderBoundary } from "@/components/providers/clerk-provider-boundary";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Workflow intelligence for agencies and operators.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProviderBoundary>
      <html lang="en" suppressHydrationWarning>
        <body className={cn("min-h-screen bg-background font-sans antialiased")}>
          <AppInit />
          {children}
          <Toaster richColors />
        </body>
      </html>
    </ClerkProviderBoundary>
  );
}
