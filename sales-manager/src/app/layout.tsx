import type { Metadata, Viewport } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AI Sales Manager",
  description: "ระบบผู้จัดการฝ่ายขาย AI — WULING CHONBURI",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={prompt.variable}>
      <body>{children}</body>
    </html>
  );
}
