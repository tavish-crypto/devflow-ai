import { NextResponse } from "next/server";
import { serverClient } from "../../../lib/supabase";
import { checkOrigin, appOrigin } from "../../../lib/security";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const db = await serverClient();
    const { error } = await db.auth.signOut();
    if (error) throw error;
    return NextResponse.redirect(`${appOrigin()}/login`, 303);
  } catch {
    return NextResponse.json(
      { message: "Unable to sign out. Try again." },
      { status: 400 },
    );
  }
}
