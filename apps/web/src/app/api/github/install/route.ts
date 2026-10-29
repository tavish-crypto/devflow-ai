import { NextResponse } from "next/server";
import { authenticate } from "../../../../lib/supabase";
import { required } from "../../../../lib/security";
export async function GET(request: Request) {
  try {
    await authenticate(request);
    const slug = required("GITHUB_APP_SLUG");
    if (!/^[a-zA-Z0-9-]+$/.test(slug)) throw new Error("slug");
    return NextResponse.redirect(
      `https://github.com/apps/${slug}/installations/new`,
    );
  } catch {
    return NextResponse.json(
      {
        code: "installation_unavailable",
        message: "Sign in and configure a GitHub App first",
      },
      { status: 503 },
    );
  }
}
