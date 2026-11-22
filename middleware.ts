import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isAllowedEmail } from "@/lib/allowed-emails";

/**
 * The web chat and its API need a session of an allowed Google account.
 * Pages without it go to the Google sign-in, /api/* answers 401.
 * Not covered (see matcher): /api/auth/* (the login itself), /api/telegram
 * (Telegram secret token), /api/cron/* (CRON_SECRET) and static assets.
 */
export async function middleware(req: NextRequest) {
  let email: string | null | undefined = null;
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    email = token?.email;
  } catch {
    email = null;
  }
  if (isAllowedEmail(email)) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const signIn = new URL("/api/auth/signin", req.url);
  signIn.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: [
    "/((?!api/auth|api/telegram|api/cron|_next/static|_next/image|favicon\\.svg|apple-icon|icon|manifest\\.json|sw\\.js|google-calendar\\.png).*)",
  ],
};
