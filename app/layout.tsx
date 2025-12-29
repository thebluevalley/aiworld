import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "旧世遗民 - AI观察者",
  description: "基于AI驱动的微缩社会实验",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      {/* 在这里直接添加背景色和文字颜色，避开 Next.js 16 的 CSS 解析问题 */}
      <body className="bg-gray-50 text-gray-800 antialiased">
        {children}
      </body>
    </html>
  );
}