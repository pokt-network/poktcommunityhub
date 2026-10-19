import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const AUTH_NEXT_COOKIE = "auth_next";

function safeNextPath(value: string | null | undefined) {
  if (!value) return "/dashboard";
  const decoded = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();
  return decoded.startsWith("/") ? decoded : "/dashboard";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;
  const code = searchParams.get("code");

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_NEXT_COOKIE}=`));
  const cookieNext = cookieMatch?.slice(`${AUTH_NEXT_COOKIE}=`.length);

  const next = safeNextPath(searchParams.get("next") ?? cookieNext);

  function finish(response: NextResponse) {
    response.cookies.set(AUTH_NEXT_COOKIE, "", {
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      try {
        await ensureAppUser(data.user);
      } catch (err) {
        console.error("[auth/callback] profile sync failed", err);
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return finish(NextResponse.redirect(`${origin}${next}`));
      }
      if (forwardedHost) {
        return finish(NextResponse.redirect(`https://${forwardedHost}${next}`));
      }
      return finish(NextResponse.redirect(`${origin}${next}`));
    }
  }

  return finish(NextResponse.redirect(`${origin}/?auth_error=1`));
}
