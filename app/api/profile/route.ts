import { NextResponse } from "next/server";
import { type Address, verifyMessage } from "viem";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AVATARS_BUCKET = "avatars";
const CHALLENGE_COOKIE = "dare_profile_challenge";
const MAX_USERNAME_LENGTH = 24;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}
function supabaseHeaders() {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };
}
async function supabaseFetch(path: string, init?: RequestInit) {
  if (!SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  return fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { ...supabaseHeaders(), ...(init?.headers || {}) }, cache: "no-store" });
}

export async function GET(request: Request) {
  try {
    const address = new URL(request.url).searchParams.get("address")?.trim();
    if (!address || !isAddress(address)) return jsonError("Invalid wallet address.");
    const res = await supabaseFetch(`/rest/v1/profiles?wallet_address=eq.${address.toLowerCase()}&select=wallet_address,username,avatar_url&limit=1`);
    if (!res.ok) return jsonError("Could not load profile metadata.", 502);
    const rows = await res.json();
    return NextResponse.json({ profile: rows[0] ?? null });
  } catch (error: any) {
    console.error("Profile GET error:", error);
    return jsonError("Could not load profile metadata.", 500);
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = rateLimit(`profile:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) return jsonError("Too many profile updates. Try again later.", 429);

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return jsonError("Profile service is not configured.", 500);
    const form = await request.formData();
    const wallet = String(form.get("wallet") || "").trim();
    const username = String(form.get("username") || "").trim();
    const signature = String(form.get("signature") || "").trim();
    const avatar = form.get("avatar");

    if (!isAddress(wallet)) return jsonError("Invalid wallet address.");
    if (!signature || !/^0x[0-9a-fA-F]+$/.test(signature)) return jsonError("Wallet signature required.");
    if (username.length > MAX_USERNAME_LENGTH || (username && !/^[a-zA-Z0-9_]{3,24}$/.test(username))) {
      return jsonError("Username must be 3-24 characters: letters, numbers or underscore.");
    }

    const challenge = request.headers.get("cookie")?.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${CHALLENGE_COOKIE}=`))?.slice(CHALLENGE_COOKIE.length + 1);
    if (!challenge) return jsonError("Profile update challenge expired. Please try again.", 401);
    const [nonce, issuedAtRaw] = decodeURIComponent(challenge).split(".");
    const issuedAt = Number(issuedAtRaw);
    if (!nonce || !Number.isSafeInteger(issuedAt) || Math.abs(Math.floor(Date.now() / 1000) - issuedAt) > 300) {
      return jsonError("Profile update challenge expired. Please try again.", 401);
    }
    const message = `Dare Protocol profile update\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
    const valid = await verifyMessage({ address: wallet as Address, message, signature: signature as `0x${string}` });
    if (!valid) return jsonError("Wallet signature verification failed.", 401);

    let avatarUrl: string | null = null;
    if (avatar instanceof File && avatar.size > 0) {
      if (!avatar.type.startsWith("image/")) return jsonError("Avatar must be an image.");
      if (avatar.size > 2 * 1024 * 1024) return jsonError("Avatar must be 2 MB or smaller.");
      const allowedExt = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
      const extension = allowedExt.get(avatar.type);
      if (!extension) return jsonError("Only JPG, PNG and WEBP avatars are supported.");
      const path = `${wallet.toLowerCase()}.${extension}`;
      const bytes = new Uint8Array(await avatar.arrayBuffer());
      const uploadRes = await supabaseFetch(`/storage/v1/object/${AVATARS_BUCKET}/${path}`, {
        method: "POST",
        headers: { "Content-Type": avatar.type, "x-upsert": "true" },
        body: bytes,
      });
      if (!uploadRes.ok) return jsonError("Avatar upload failed.", 502);
      avatarUrl = `${SUPABASE_URL}/storage/v1/object/public/${AVATARS_BUCKET}/${path}`;
    }

    const row: Record<string, unknown> = {
      wallet_address: wallet.toLowerCase(),
      username: username || null,
      updated_at: new Date().toISOString(),
    };
    if (avatarUrl) row.avatar_url = avatarUrl;

    const upsertRes = await supabaseFetch("/rest/v1/profiles?on_conflict=wallet_address", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([row]),
    });
    if (!upsertRes.ok) return jsonError("Could not save profile.", 502);
    const rows = await upsertRes.json();
    const profile = rows[0] ?? row;
    const response = NextResponse.json({ profile });
    response.cookies.set(CHALLENGE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/profile", maxAge: 0 });
    return response;
  } catch (error: any) {
    console.error("Profile POST error:", error);
    return jsonError("Could not save profile.", 500);
  }
}
