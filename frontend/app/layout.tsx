import "./globals.css";
import ReduxProvider from "@/store/Provider";
import SecretEntry from "@/components/SecretEntry";

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
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;600&family=Sarabun:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ReduxProvider>{children}</ReduxProvider>
        <SecretEntry />
      </body>
    </html>
  );
}
