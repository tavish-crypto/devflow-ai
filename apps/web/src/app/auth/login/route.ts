import { NextResponse } from "next/server";
import { z } from "zod";
import { appOrigin, checkOrigin, ApiFault } from "../../../lib/security";
import { serverClient, rateLimit } from "../../../lib/supabase";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await rateLimit("auth:login:global", 20);
    const text = await request.text();
    if (text.length > 2000)
      return NextResponse.json(
        { code: "body_too_large", message: "Form too large" },
        { status: 413 },
      );
    const email = z
      .email()
      .max(254)
      .parse(new URLSearchParams(text).get("email"));
    const db = await serverClient();
    const { error } = await db.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${appOrigin()}/auth/callback` },
    });
    if (error?.code === "over_email_send_rate_limit")
      return NextResponse.json(
        {
          code: "email_rate_limited",
          message:
            "Email sending limit reached. Please wait before requesting another sign-in link.",
        },
        { status: 429 },
      );
    if (error)
      return NextResponse.json(
        { code: "login_failed", message: "Unable to send magic link" },
        { status: 400 },
      );
    return NextResponse.json({
      message: "Check your email for a sign-in link.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: error instanceof ApiFault ? error.code : "invalid_request",
        message: "Unable to start sign-in",
      },
      { status: error instanceof ApiFault ? error.status : 400 },
    );
  }
}
