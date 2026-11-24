import type { Metadata, Viewport } from "next";
import RegisterSW from "@/components/RegisterSW";
import { Prompt } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "MKT Content Manager",
  description: "ระบบจัดการคอนเทนต์การตลาด",
  applicationName: "MKT",
  appleWebApp: { capable: true, title: "MKT", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={prompt.variable}>
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
