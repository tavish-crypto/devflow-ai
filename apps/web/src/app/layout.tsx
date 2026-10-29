import type { ReactNode } from "react";
import "./style.css";
export const metadata = {
  title: "DevFlow AI",
  description: "Evidence-backed, user-reviewed developer issue drafts",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
