import type { ReactNode } from "react";
import { requireUser } from "../../lib/require-user";
import Workspace from "../../components/workspace";
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <Workspace id={user.id} email={user.email ?? "Your account"}>
      {children}
    </Workspace>
  );
}
