// apps/server/src/guards.ts — the two checks every protected route makes: who are you, may you
import type { Role, User } from "field-app-contract/contract";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { userFromToken } from "./jwt";
import { problem } from "./problem";

// what a handler behind requireUser can read: c.get("user")
export interface SignedIn {
  Variables: { user: User };
}

// 401: no token, a forged one, or one past its exp
export const requireUser = createMiddleware<SignedIn>(async (c, next) => {
  const token = getCookie(c, "session");
  const user = token ? await userFromToken(token) : undefined;
  if (!user) {
    return problem(c, 401, "Sign in first");
  }
  c.set("user", user);
  await next();
});

// 403: signed in, but not allowed; put it after requireUser
export const requireRole = (role: Role) =>
  createMiddleware<SignedIn>(async (c, next) => {
    if (c.get("user").role !== role) {
      return problem(c, 403, `Only an ${role} can do this`);
    }
    await next();
  });
