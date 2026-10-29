import "server-only";
import { redirect } from "next/navigation";
import { serverClient } from "./supabase";
export async function requireUser() {
  let user;
  try {
    const db = await serverClient();
    const result = await db.auth.getUser();
    user = result.error ? null : result.data.user;
  } catch {
    user = null;
  }
  if (!user) redirect("/login");
  return user;
}
