// apps/server/src/jwt.ts — step 7: the session as a signed token (a JWT) instead of a row
import type { User } from "field-app-contract/contract";
import { sign, verify } from "hono/jwt";
import { getUser } from "./db/users";

// HMAC with SHA-256: one secret key signs and checks
const ALG = "HS256";

// read when it is needed: a missing key fails the request, loudly, as a 500
function secret(): string {
  const key = Bun.env.JWT_SECRET;
  if (!key || key.length < 32) {
    throw new Error(
      "Set JWT_SECRET (32 characters or more) in apps/server/.env: copy .env.example"
    );
  }
  return key;
}

// sub: who; exp: until when, in seconds. Signed, not encrypted: anyone can read it
export function signToken(user: User, seconds: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + seconds;
  return sign({ exp, sub: user.id }, secret(), ALG);
}

// the user, if the signature is ours and exp has not passed: no table is asked about the token
export async function userFromToken(token: string): Promise<User | undefined> {
  const key = secret();
  try {
    const { sub } = await verify(token, key, ALG);
    return typeof sub === "string" ? getUser(sub) : undefined;
  } catch {
    // a signature that is not ours, a malformed token, or one past exp
    return undefined;
  }
}
