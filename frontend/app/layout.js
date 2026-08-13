import "./globals.css";
import ReduxProvider from "@/store/Provider";

export const metadata = {
  title: "CTRL — มอนิเตอร์น้ำ-ไฟ และบิลรายเดือน",
  description: "CTRL: ระบบมอนิเตอร์มิเตอร์น้ำ-ไฟรายห้อง และออกบิลรายเดือน สำหรับหอพัก อพาร์ตเมนต์ คอนโด",
};

// CSS url("/x.svg") is served from origin root, so under a subpath (e.g. /CTRL_MOCK)
// the SVG backgrounds 404. Bake basePath-aware asset URLs into CSS vars here (this is
// a server component, so it reads NEXT_PUBLIC_BASE_PATH at render). globals.css falls
// back to the root path when the vars are absent.
const BP = process.env.NEXT_PUBLIC_BASE_PATH || "";
const assetVars = `:root{--bg-hero:url("${BP}/bg-hero.svg");--bg-pattern:url("${BP}/bg-pattern.svg")}`;

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <style dangerouslySetInnerHTML={{ __html: assetVars }} />
      </head>
      <body>
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
