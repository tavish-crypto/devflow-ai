import { NextResponse } from "next/server";
import { authenticate, rateLimit } from "../../../../lib/supabase";
import {
  appOrigin,
  secret,
  required,
  ApiFault,
  encrypt,
} from "../../../../lib/security";
export async function GET(request: Request) {
  try {
    const actor = await authenticate(request);
    await rateLimit(`oauth:${actor.userId}`, 10);
    const state = secret();
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", required("GITHUB_CLIENT_ID"));
    url.searchParams.set("redirect_uri", `${appOrigin()}/api/github/callback`);
    url.searchParams.set("state", state);
    const response = NextResponse.redirect(url);
    response.cookies.set(
      "df_oauth_state",
      encrypt(JSON.stringify({ state, userId: actor.userId })),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/github/callback",
        maxAge: 600,
      },
    );
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        code: "authorization_failed",
        message: "Sign in and configure the GitHub App first",
      },
      { status: error instanceof ApiFault ? error.status : 503 },
    );
  }
}
