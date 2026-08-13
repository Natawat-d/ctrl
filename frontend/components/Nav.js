import Link from "next/link";

export default function Nav({ children }) {
  return (
    <nav className="nav">
      <Link href="/dashboard" className="brand" style={{ color: "inherit" }}>
        <span className="dots">
          <span className="dot" style={{ background: "var(--elec)" }} />
          <span className="dot" style={{ background: "var(--water)" }} />
        </span>
        arkara <span style={{ color: "var(--muted)", fontWeight: 500 }}>smart electric</span>
      </Link>
      <div className="nav-actions">{children}</div>
    </nav>
  );
}
