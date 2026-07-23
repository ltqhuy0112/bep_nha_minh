import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import {
  countRecentFailedLoginAttempts,
  findAdminUserByEmail,
  recordAdminLoginAttempt,
  updateAdminLastLogin
} from "@/db/queries/admin-users";
import { getPermissionsForRole, isAdminRole } from "@/lib/admin/permissions";
import { verifyAdminPassword } from "@/lib/admin/password";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1)
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: {
    signIn: "/admin/login"
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8
  },
  providers: [
    Credentials({
      name: "Admin email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;
        const recentFailures = await countRecentFailedLoginAttempts(email);
        if (recentFailures >= 5) {
          await recordAdminLoginAttempt({
            email,
            success: false,
            failureReason: "rate_limited"
          });
          return null;
        }

        const user = await findAdminUserByEmail(email);
        if (!user || !user.is_active) {
          await recordAdminLoginAttempt({
            email,
            success: false,
            failureReason: "invalid_credentials"
          });
          return null;
        }

        const validPassword = await verifyAdminPassword(
          password,
          user.password_hash
        );

        if (!validPassword) {
          await recordAdminLoginAttempt({
            email,
            success: false,
            failureReason: "invalid_credentials"
          });
          return null;
        }

        await recordAdminLoginAttempt({ email, success: true });
        await updateAdminLastLogin(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.permissions = isAdminRole(user.role)
          ? getPermissionsForRole(user.role)
          : [];
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id);
        session.user.role = String(token.role);
        session.user.permissions = Array.isArray(token.permissions)
          ? token.permissions.map(String)
          : [];
      }

      return session;
    }
  }
});
