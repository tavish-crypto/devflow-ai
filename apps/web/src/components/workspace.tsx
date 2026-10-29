"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Brand,
  Button,
  LayoutDashboard,
  CircleDot,
  Github,
  Settings,
  Plus,
  Menu,
  PanelLeftClose,
  MousePointer2,
} from "@devflow/product";
const Identity = createContext({ id: "", email: "" });
export const useIdentity = () => useContext(Identity);
export default function Workspace({
  children,
  id,
  email,
}: {
  children: ReactNode;
  id: string;
  email: string;
}) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false);
  const nav = [
    ["/dashboard", "Overview", LayoutDashboard],
    ["/dashboard/issues", "Issues", CircleDot],
    ["/dashboard/integrations", "Integrations", Github],
    ["/dashboard/settings", "Settings", Settings],
  ] as const;
  const active = nav.find(([url]) =>
    url === "/dashboard" ? path === url : path.startsWith(url),
  );
  return (
    <Identity.Provider value={{ id, email }}>
      <div className={`workspace ${collapsed ? "sidebar-collapsed" : ""}`}>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <aside
          className={`sidebar ${mobile ? "mobile-open" : ""}`}
          aria-label="Workspace navigation"
        >
          <a href="/" aria-label="DevFlow home">
            <Brand compact={collapsed} />
          </a>
          <div className="workspace-label">
            <span>P</span> Personal workspace
          </div>
          <span className="eyebrow">WORKSPACE</span>
          <nav className="nav-links">
            {nav.map(([url, label, Icon]) => (
              <a
                key={url}
                href={url}
                aria-label={label}
                aria-current={active?.[0] === url ? "page" : undefined}
                className={active?.[0] === url ? "active" : ""}
              >
                <Icon size={17} />
                <span className="nav-label">{label}</span>
              </a>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-tip">
              <MousePointer2 size={19} />
              <h3>Keep your context.</h3>
              <p>
                Select an error on any webpage and capture it with the DevFlow
                extension.
              </p>
              <Button asChild variant="secondary">
                <a href="/connect-extension">Connect extension</a>
              </Button>
            </div>
            <a className="account-chip" href="/dashboard/settings">
              <span className="avatar">
                {email.slice(0, 1).toUpperCase() || "D"}
              </span>
              <div>
                <strong>{email}</strong>
                <small>Personal workspace</small>
              </div>
            </a>
          </div>
        </aside>
        <div>
          <header className="topbar">
            <div className="actions">
              <button
                className="icon-button mobile-toggle"
                onClick={() => setMobile(!mobile)}
                aria-label="Toggle navigation"
                aria-expanded={mobile}
              >
                <Menu size={19} />
              </button>
              <button
                className="icon-button collapse-toggle"
                onClick={() => setCollapsed(!collapsed)}
                aria-label="Collapse sidebar"
                aria-expanded={!collapsed}
              >
                <PanelLeftClose size={17} />
              </button>
              <span>
                Workspace <span className="muted"> / </span>{" "}
                {active?.[1] ?? "Capture"}
              </span>
            </div>
            <div className="topbar-right">
              <span className="muted">Evidence-backed. Human-reviewed.</span>
              <Button asChild variant="secondary">
                <a href="/dashboard/new">
                  <Plus size={14} />
                  New issue
                </a>
              </Button>
            </div>
          </header>
          <main id="main-content" className="content">
            {children}
          </main>
        </div>
      </div>
    </Identity.Provider>
  );
}
