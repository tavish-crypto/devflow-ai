import { NextResponse } from "next/server";
import { serverClient } from "../../../lib/supabase";
import { appOrigin } from "../../../lib/security";
export async function GET(request: Request) {
  try {
    const code = new URL(request.url).searchParams.get("code");
    if (code) {
      const db = await serverClient();
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${appOrigin()}/dashboard`);
    }
  } catch {
    /* Do not expose auth provider details. */
  }
  return NextResponse.json(
    { code: "auth_failed", message: "Sign-in link is invalid or expired" },
    { status: 401 },
  );
}
