import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { isAllowedEmail } from "./allowed-emails";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.events",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    // Only the allowed Google accounts can sign in (any other gets "Access denied").
    async signIn({ user, profile }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const verified = (profile as any)?.email_verified !== false;
      return verified && isAllowedEmail(user.email ?? profile?.email);
    },
    async jwt({ token, account }) {
      // First sign-in: persist tokens + granted scopes from Google
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at, // unix seconds
          scope: account.scope ?? "",    // e.g. "openid email profile https://www.googleapis.com/auth/calendar.events"
        };
      }
      // Token still valid
      if (token.expiresAt && Date.now() / 1000 < token.expiresAt - 60) {
        return token;
      }
      // Access token expired — attempt refresh
      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken ?? "",
          }),
        });
        const refreshed = await res.json();
        if (!res.ok) throw refreshed;
        return {
          ...token,
          accessToken: refreshed.access_token,
          expiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in,
          // scope stays the same after refresh
        };
      } catch {
        return { ...token, error: "RefreshAccessTokenError" };
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.scope = token.scope;
      session.error = token.error;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  // No custom sign-in page: "/" is now behind login (middleware.ts), so the
  // default NextAuth page is used and redirects back to the app after login.
};
