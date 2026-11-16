// apps/server/src/auth.test.ts — signing in and out, end to end through app.request()
import { beforeAll, expect, test } from "bun:test";
import { migrate } from "../scripts/migrate";
import { seed } from "../scripts/seed";
import { db } from "./db";
import app from "./index";
import { ANDREI, cookieOf, IRINA, PASSWORD, signIn } from "./testing";

const IRINA_ID = "7d07e973-eebc-44b1-b7cd-bd1cd2fff3c5"; // a fixture

// session=<header>.<payload>.<signature>, each base64url; then the attributes
const SESSION_COOKIE = /^session=[\w-]+\.[\w-]+\.[\w-]+; /;

const withCookie = (res: Response) => ({ headers: { Cookie: cookieOf(res) } });

beforeAll(() => {
  if (db.$client.filename !== ":memory:") {
    throw new Error(`Refusing to test on ${db.$client.filename}`);
  }
  migrate();
  seed(PASSWORD);
});

test("the seed refuses to run without a password", () => {
  expect(() => seed(undefined)).toThrow("SEED_PASSWORD");
});

test("the seed stores a hash, never the password", () => {
  const { password } = db.$client
    .query<{ password: string }, []>(
      "SELECT password FROM account WHERE provider_id = 'credential' LIMIT 1"
    )
    .get() ?? { password: "" };
  expect(password).toStartWith("$argon2id$");
  expect(password).not.toContain(PASSWORD);
});

test("the right password signs in: an HttpOnly, SameSite=Lax cookie and the user", async () => {
  const res = await signIn(IRINA, PASSWORD);
  expect(res.status).toBe(200);
  expect(((await res.json()) as { role: string }).role).toBe("admin");
  const cookie = res.headers.get("set-cookie") ?? "";
  expect(cookie).toMatch(SESSION_COOKIE);
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=Lax");
  expect(cookie).not.toContain("Secure"); // only in production: localhost is http
  const me = await app.request("/api/auth/me", withCookie(res));
  expect(((await me.json()) as { email: string }).email).toBe(IRINA);
});

test("the email's case and spaces do not matter", async () => {
  const res = await signIn(` ${IRINA.toUpperCase()} `, PASSWORD);
  expect(res.status).toBe(200);
  expect(((await res.json()) as { email: string }).email).toBe(IRINA);
});

test("a wrong password is a 401, and so is an unknown email, word for word", async () => {
  const wrong = await signIn(IRINA, "not-the-password");
  const unknown = await signIn("nobody@example.com", PASSWORD);
  expect(wrong.status).toBe(401);
  expect(unknown.status).toBe(401);
  // the same answer: nobody learns which emails have an account
  expect(await wrong.json()).toEqual(await unknown.json());
  expect(wrong.headers.get("set-cookie")).toBeNull();
});

test("no cookie, or a made-up one, is a 401", async () => {
  expect((await app.request("/api/auth/me")).status).toBe(401);
  const madeUp = await app.request("/api/auth/me", {
    headers: { Cookie: "session=made-up" },
  });
  expect(madeUp.status).toBe(401);
});

test("the token is signed: Andrei's token, changed to say Irina, is a 401", async () => {
  const token = cookieOf(await signIn(ANDREI)).slice("session=".length);
  const [header, payload, signature] = token.split(".");
  // the payload is base64url, not encrypted: anyone can read it, and try to change it
  const claims = JSON.parse(Buffer.from(payload ?? "", "base64url").toString());
  const forged = Buffer.from(
    JSON.stringify({ ...claims, sub: IRINA_ID })
  ).toString("base64url");
  const res = await app.request("/api/auth/me", {
    headers: { Cookie: `session=${header}.${forged}.${signature}` },
  });
  expect(res.status).toBe(401);
});

// the lesson of step 7, as a test: there is no row to delete, so nothing to revoke
test("sign-out cannot revoke a JWT: a copy of the cookie still passes", async () => {
  const signedIn = await signIn(IRINA, PASSWORD);
  const cookie = withCookie(signedIn);
  const out = await app.request("/api/auth/sign-out", {
    ...cookie,
    method: "POST",
  });
  expect(out.status).toBe(204);
  expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
  // the browser forgot it; a copy kept from before works until it expires
  expect((await app.request("/api/auth/me", cookie)).status).toBe(200);
});

test("the OpenAPI document says sign-in answers the user alone: the token is in the cookie", async () => {
  const doc = await (await app.request("/api/openapi.json")).text();
  const signInDoc = JSON.stringify(
    (JSON.parse(doc) as { paths: Record<string, unknown> }).paths[
      "/api/auth/sign-in"
    ]
  );
  expect(signInDoc).toContain('"email"');
  expect(signInDoc).not.toContain('"token"');
});
