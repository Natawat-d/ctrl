"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import Icon from "./Icon";
import Toaster from "./Toast";
import { selectUser, logout } from "@/store/authSlice";
import { fetchMarkets, setActive, selectActiveMarket } from "@/store/marketSlice";

const NAV = {
  owner: [
    { href: "/dashboard", icon: "grid", label: "แดชบอร์ด" },
    { href: "/tenants", icon: "users", label: "ผู้เช่า" },
    { href: "/bills", icon: "receipt", label: "บิล" },
    { href: "/reports", icon: "chart", label: "รายงาน" },
    { href: "/audit", icon: "log", label: "บันทึก" },
    { href: "/settings", icon: "settings", label: "ตั้งค่า" },
  ],
  platform_admin: [
    { href: "/admin", icon: "grid", label: "ผู้ดูแลระบบ" },
    { href: "/audit", icon: "log", label: "บันทึก" },
  ],
  tenant_user: [{ href: "/me", icon: "home", label: "หน้าหลัก" }],
};
const ROLE_LABEL = { platform_admin: "ผู้ดูแลระบบ", owner: "เจ้าของอาคาร", tenant_user: "ผู้เช่า" };

// actions/sub/children เป็น optional — หน้าอย่าง /tenants /settings ส่งแค่ title+sub มา
// (ห้ามใช้ default `actions = null` เพราะ strict จะ infer ชนิดเป็น null แล้วหน้าที่ส่ง JSX
//  เข้ามาใน actions เช่น /dashboard /bills /reports จะพัง)
type AppTopProps = {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

export default function AppTop({ title, sub, actions, children }: AppTopProps) {
  const path = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const markets = useAppSelector((s) => s.markets.items);
  const active = useAppSelector(selectActiveMarket);
  const role = user?.role || "owner";
  const nav = NAV[role] || NAV.owner;
  const showSwitch = role === "owner"; // only owners manage/switch multiple sites

  useEffect(() => {
    if (user && showSwitch && !markets.length) dispatch(fetchMarkets());
  }, [dispatch, user, showSwitch, markets.length]);

  function doLogout() { dispatch(logout()); router.push("/login"); }
  function switchMarket(id) {
    dispatch(setActive(id));
    if (typeof window !== "undefined") window.location.reload();
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><img className="logo-img" src="/logo.png" alt="CTRL" /></div>
        <div className="side-cap">เมนู</div>
        <nav className="side-nav">
          {nav.map((it) => (
            <Link key={it.href} href={it.href} className={"side-item" + (path.startsWith(it.href) ? " active" : "")}>
              <Icon name={it.icon} /><span>{it.label}</span>
            </Link>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="side-user">
            <div className="av">{(user?.display_name || "?").slice(0, 1).toUpperCase()}</div>
            <div className="who">
              <div className="nm">{user?.display_name || "-"}</div>
              <div className="rl">{ROLE_LABEL[role] || ""}</div>
            </div>
          </div>
          <button className="side-logout" onClick={doLogout}><Icon name="logout" /> ออกจากระบบ</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            {sub && <div className="sub">{sub}</div>}
          </div>
          <div className="right">
            {actions}
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
      <Toaster />


    </div>
  );
}
