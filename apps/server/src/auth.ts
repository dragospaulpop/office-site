// apps/server/src/auth.ts — sign-in by hand: Bun.password, and (step 7) a JWT in the HttpOnly cookie
import { fieldErrors, SignIn } from "@office/shared";
import { User } from "field-app-contract/contract";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { describeRoute } from "hono-openapi";
import { findCredential } from "./db/auth";
import { signToken, userFromToken } from "./jwt";
import { json, jsonBody, problemJson } from "./openapi";
import { problem } from "./problem";

export const authApi = new Hono();

// a week: the cookie and the token's exp end together
const SESSION_SECONDS = 60 * 60 * 24 * 7;

// 32 random bytes from the operating system's generator, as URL-safe text
const newToken = () =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

// checked when the email is unknown, so a wrong email takes as long as a wrong password
const NO_SUCH_USER = Bun.password.hashSync(newToken());

authApi.post(
  "/sign-in",
  describeRoute({
    requestBody: jsonBody(SignIn),
    responses: {
      200: json(
        "Signed in: the user; the session is in an HttpOnly cookie",
        User
      ),
      400: problemJson("Not an email, or no password"),
      401: problemJson("Wrong email or password"),
    },
    security: [],
    summary: "Sign in with an email and a password",
    tags: ["auth"],
  }),
  async (c) => {
    const result = SignIn.safeParse(await c.req.json().catch(() => null));
    if (!result.success) {
      return problem(c, 400, "Type an email and a password", {
        errors: fieldErrors(result.error),
      });
    }
    const { email, password } = result.data;
    const found = findCredential(email);
    const ok = await Bun.password.verify(password, found?.hash ?? NO_SUCH_USER);
    // one answer for both mistakes: nobody learns which emails have an account
    if (!(ok && found)) {
      return problem(c, 401, "Wrong email or password");
    }
    // no row: the token carries who you are, signed with JWT_SECRET
    const token = await signToken(found.user, SESSION_SECONDS);
    // HttpOnly: no script can read it; Lax: other sites' forms cannot send it;
    // Secure (https only) in production: localhost is http
    setCookie(c, "session", token, {
      httpOnly: true,
      maxAge: SESSION_SECONDS,
      path: "/",
      sameSite: "Lax",
      secure: Bun.env.NODE_ENV === "production",
    });
    return c.json(found.user);
  }
);

// GET /api/auth/me: who is signed in, from the cookie the browser sends
authApi.get(
  "/me",
  describeRoute({
    responses: {
      200: json("The signed-in user", User),
      401: problemJson("Not signed in"),
    },
    summary: "Who is signed in",
    tags: ["auth"],
  }),
  async (c) => {
    const token = getCookie(c, "session");
    const user = token ? await userFromToken(token) : undefined;
    return user ? c.json(user) : problem(c, 401, "Sign in first");
  }
);

// the browser forgets the cookie; there is no row to delete, so a copy of the token
// still works until its exp: a JWT cannot be revoked (and that is why we go back)
authApi.post(
  "/sign-out",
  describeRoute({
    responses: { 204: { description: "Signed out" } },
    summary: "Sign out",
    tags: ["auth"],
  }),
  (c) => {
    deleteCookie(c, "session", { path: "/" });
    return c.body(null, 204);
  }
);
