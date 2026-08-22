"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Icon from "./Icon";
import { getUser } from "@/lib/api";

const NAV = [
  { href: "/dashboard", icon: "grid", label: "แดชบอร์ด" },
  { href: "/tenants", icon: "users", label: "ผู้เช่า" },
  { href: "/bills", icon: "receipt", label: "บิล" },
  { href: "/settings", icon: "settings", label: "ตั้งค่า" },
];

export default function Shell({ title, sub, actions, children }) {
  const path = usePathname();
  const router = useRouter();
  const user = typeof window !== "undefined" ? getUser() : null;

  const displayName = user?.display_name || "ผู้ใช้";
  const roleLabel = user?.role === "owner" ? "เจ้าของอาคาร" : user?.role || "";
  const initials = displayName.trim().charAt(0).toUpperCase() || "U";

  function logout() {
    localStorage.removeItem("akr_token");
    localStorage.removeItem("akr_user");
    router.push("/login");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-brand">
          <img className="logo-img" src="/logo.jpg" alt="CTRL" />
        </div>
        <nav className="side-nav">
          {NAV.map((it) => (
            <Link key={it.href} href={it.href} className={"side-link" + (path.startsWith(it.href) ? " active" : "")}>
              <Icon name={it.icon} />
              <span>{it.label}</span>
            </Link>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="side-user">
            <div className="av">{initials}</div>
            <div className="who">
              <div className="nm">{displayName}</div>
              <div className="rl">{roleLabel}</div>
            </div>
          </div>
          <button className="side-logout" onClick={logout}>
            <Icon name="logout" /> ออกจากระบบ
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            {sub && <div className="sub">{sub}</div>}
          </div>
          <div className="topbar-actions">{actions}</div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
