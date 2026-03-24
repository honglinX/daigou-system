
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

const inter = Inter({ subsets: ["latin"] });

import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "代购业务管理系统",
  description: "零成本架构的代购CRM与订单流转系统",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "代购系统",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased bg-gray-50 dark:bg-zinc-900">
      <body className={`${inter.className} flex h-full overflow-hidden text-gray-900 dark:text-gray-100`}>
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-y-auto w-full pb-20 md:pb-0 relative">
          {children}
        </main>
      </body>
    </html>
  );
}
