import "./globals.css";
import ReduxProvider from "@/store/Provider";

export const metadata = {
  title: "CTRL — มอนิเตอร์น้ำ-ไฟ และบิลรายเดือน",
  description: "CTRL: ระบบมอนิเตอร์มิเตอร์น้ำ-ไฟรายห้อง และออกบิลรายเดือน สำหรับหอพัก อพาร์ตเมนต์ คอนโด",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
