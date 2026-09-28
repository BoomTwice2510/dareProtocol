import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
const COOKIE = "dare_profile_challenge";
const MAX_AGE = 300;

export async function GET() {
  const nonce = randomBytes(32).toString("hex");
  const issuedAt = Math.floor(Date.now() / 1000);
  const message = `Dare Protocol profile update\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
  const response = NextResponse.json({ message });
  response.cookies.set(COOKIE, `${nonce}.${issuedAt}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/profile",
    maxAge: MAX_AGE,
  });
  return response;
}
