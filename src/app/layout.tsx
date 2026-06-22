import type { Metadata } from "next";
import { Outfit, Anuphan } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const anuphan = Anuphan({
  variable: "--font-anuphan",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "ระบบบันทึกการเปลี่ยนถ่ายน้ำยาฟอกไต (CAPD Tracker)",
  description: "ระบบบันทึกการเปลี่ยนถ่ายน้ำยาฟอกไตและติดตามขั้นตอนการทำงานแบบเรียลไทม์",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${outfit.variable} ${anuphan.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

