import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { createActiveLoginSession, requestDeviceInfo } from "@/lib/device-session";
import type { SessionUser } from "@/types";

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const LOGIN_UNAVAILABLE_MESSAGE =
  "We could not sign you in right now. Please try again in a moment or contact support if the issue continues.";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required");
        }

        try {
          const email = normalizeEmail(credentials.email);
          const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              passwordHash: true,
              isActive: true,
              companies: {
                where: {
                  company: { isActive: true, deletedAt: null },
                },
                select: {
                  id: true,
                  userId: true,
                  companyId: true,
                  role: true,
                  isActive: true,
                  joinedAt: true,
                  createdAt: true,
                  updatedAt: true,
                  company: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      logo: true,
                    },
                  },
                },
              },
            },
          });

          if (!user || !user.passwordHash) {
            throw new Error("Invalid credentials");
          }

          const isValid = await verifyPassword(credentials.password, user.passwordHash);
          if (!isValid) {
            throw new Error("Invalid credentials");
          }

          // Emergency recovery for tenant-login breakage caused by older user-management code:
          // tenant activation/deactivation accidentally wrote to User.isActive globally.
          // After a valid password, recover the base account and at least one company membership.
          if (!user.isActive) {
            await prisma.user.update({
              where: { id: user.id },
              data: { isActive: true },
            });
          }

          let loginMemberships = user.companies.filter((m) => m.isActive);

          if (loginMemberships.length === 0 && user.companies.length > 0) {
            await prisma.companyMembership.updateMany({
              where: {
                userId: user.id,
                company: { isActive: true, deletedAt: null },
              },
              data: { isActive: true },
            });
            loginMemberships = user.companies.map((m) => ({ ...m, isActive: true }));
          }

          if (loginMemberships.length === 0) {
            throw new Error("No active company membership");
          }

          const activeLoginSession = await createActiveLoginSession(
            user.id,
            requestDeviceInfo(req.headers || {}),
          );

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            activeLoginSessionId: activeLoginSession.id,
            companies: loginMemberships.map((m) => ({
              ...m.company,
              membership: {
                id: m.id,
                userId: m.userId,
                companyId: m.companyId,
                role: m.role,
                isActive: true,
                joinedAt: m.joinedAt,
                createdAt: m.createdAt,
                updatedAt: m.updatedAt,
              },
            })),
          };
        } catch (error) {
          if (error instanceof Error) {
            if (
              error.message === "Invalid credentials" ||
              error.message === "Account is deactivated" ||
              error.message === "No active company membership"
            ) {
              throw error;
            }
          }

          console.error("Login authorization failed", error);
          throw new Error(LOGIN_UNAVAILABLE_MESSAGE);
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
        token.activeLoginSessionId = (user as any).activeLoginSessionId;
      }

      // Always ensure company context is set, even if membership was added after login
      if ((user || !token.companyId || trigger === "update") && token.id) {
        const memberships = await prisma.companyMembership.findMany({
          where: {
            userId: token.id as string,
            isActive: true,
            company: { isActive: true, deletedAt: null },
          },
          orderBy: { createdAt: "asc" },
          select: {
            role: true,
            company: { select: { id: true, slug: true } },
          },
        });

        if (memberships.length > 0) {
          const membership = memberships[0];
          token.companyId = membership.company.id;
          token.companySlug = membership.company.slug;
          token.role = membership.role;
        }
      }

      if (trigger === "update" && session) {
        Object.assign(token, session);
      }

      if (token.id) {
        const freshUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, email: true, image: true },
        });
        if (freshUser) {
          token.name = freshUser.name;
          token.email = freshUser.email;
          token.picture = freshUser.image;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as SessionUser).id = token.id as string;
        session.user.name = (token.name as string | null) ?? session.user.name;
        session.user.email = (token.email as string | null) ?? session.user.email;
        session.user.image = (token.picture as string | null) ?? session.user.image;

        // If the JWT is missing company context, try to fetch it from the database.
        // This handles the case where the user was signed in before being assigned to a company.
        if (!token.companyId && token.id) {
          try {
            const membership = await prisma.companyMembership.findFirst({
              where: {
                userId: token.id as string,
                isActive: true,
                company: { isActive: true, deletedAt: null },
              },
              orderBy: { createdAt: "asc" },
              select: {
                role: true,
                company: { select: { id: true, slug: true } },
              },
            });
            if (membership) {
              token.companyId = membership.company.id;
              token.companySlug = membership.company.slug;
              token.role = membership.role;
            }
          } catch {}
        }

        (session.user as SessionUser).companyId = token.companyId as string;
        (session.user as SessionUser).companySlug = token.companySlug as string;
        (session.user as SessionUser).role = token.role as string;
        (session.user as SessionUser).activeLoginSessionId = token.activeLoginSessionId as string;
      }
      return session;
    },
  },
  events: {
    async signOut(message) {
      const sessionId = (message.token as any)?.activeLoginSessionId;
      if (!sessionId) return;
      await prisma.activeLoginSession.deleteMany({ where: { id: sessionId as string } });
    },
  },
};
