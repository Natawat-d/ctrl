import Link from "next/link";

export default function Nav({ children }) {
  return (
    <nav className="nav">
      <Link href="/dashboard" className="brand" style={{ color: "inherit" }}>
        <img className="logo-img" src="/logo.jpg" alt="CTRL" />
      </Link>
      <div className="nav-actions">{children}</div>
    </nav>
  );
}
