import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { authenticate, admin } from "../../../../lib/supabase";
import {
  appOrigin,
  encrypt,
  decrypt,
  required,
} from "../../../../lib/security";
import { gh } from "../../../../lib/github";
export async function GET(request: Request) {
  const jar = await cookies();
  try {
    const actor = await authenticate(request);
    const query = new URL(request.url).searchParams;
    const state = query.get("state") || "";
    const cookie = jar.get("df_oauth_state")?.value;
    jar.set("df_oauth_state", "", { path: "/api/github/callback", maxAge: 0 });
    if (!cookie) throw new Error("state");
    const saved = JSON.parse(decrypt(cookie)) as {
      state: string;
      userId: string;
    };
    const expected = saved.state;
    if (saved.userId !== actor.userId) throw new Error("account_changed");
    if (
      !expected ||
      state.length !== expected.length ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(expected))
    )
      throw new Error("state");
    const code = query.get("code");
    if (!code || code.length > 500) throw new Error("code");
    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: required("GITHUB_CLIENT_ID"),
          client_secret: required("GITHUB_CLIENT_SECRET"),
          code,
          redirect_uri: `${appOrigin()}/api/github/callback`,
        }),
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      },
    );
    if (!response.ok) throw new Error("oauth");
    const token = (await response.json()) as { access_token?: string };
    if (!token.access_token) throw new Error("token");
    const user = (await gh("/user", token.access_token)) as { id: number };
    const installations = (await gh(
      "/user/installations?per_page=100",
      token.access_token,
    )) as {
      installations: { id: number; app_id: number }[];
      total_count: number;
    };
    if (installations.total_count > 100) throw new Error("installation_limit");
    const requested = query.get("installation_id");
    const eligible = installations.installations.filter(
      (i) => String(i.app_id) === required("GITHUB_APP_ID"),
    );
    const installation = requested
      ? eligible.find((i) => String(i.id) === requested)
      : eligible.length === 1
        ? eligible[0]
        : undefined;
    if (!installation) throw new Error("installation");
    const { error } = await admin()
      .from("github_connections")
      .upsert({
        user_id: actor.userId,
        installation_id: installation.id,
        github_user_id: user.id,
        encrypted_user_token: encrypt(token.access_token),
        metadata: { verifiedAt: new Date().toISOString() },
      });
    if (error) throw error;
    return NextResponse.redirect(`${appOrigin()}/?github=connected`);
  } catch {
    return NextResponse.json(
      {
        code: "github_authorization_failed",
        message:
          "Authorization failed. Install this GitHub App on selected repositories, then reconnect. Multiple installations require an explicit installation selection.",
      },
      { status: 400 },
    );
  }
}
