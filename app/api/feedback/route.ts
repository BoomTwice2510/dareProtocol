import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const rl = rateLimit(`feedback:${getClientIp(req)}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many feedback requests. Try again later." }, { status: 429 });
  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 128 * 1024) return NextResponse.json({ error: "Feedback payload is too large." }, { status: 413 });
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const rating = body?.rating == null || body.rating === "" ? null : Number(body.rating);
    const screenshotUrl = typeof body?.screenshotUrl === "string" ? body.screenshotUrl : "";
    if (!message || message.length > 5000) return NextResponse.json({ error: "Message must be 1-5000 characters." }, { status: 400 });
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) return NextResponse.json({ error: "Invalid rating." }, { status: 400 });
    if (screenshotUrl && (!screenshotUrl.startsWith("data:image/") || screenshotUrl.length > 100 * 1024)) return NextResponse.json({ error: "Screenshot is invalid or too large." }, { status: 400 });

    const toEmail = process.env.FEEDBACK_TO_EMAIL;
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!toEmail || !resendApiKey) return NextResponse.json({ error: "Feedback service is not configured" }, { status: 503 });
    const resend = new Resend(resendApiKey);
    const result = await resend.emails.send({
      from: "Dare Feedback <onboarding@resend.dev>",
      to: toEmail,
      subject: `New Dare feedback${rating ? ` (rating: ${rating})` : ""}`,
      text: [`Feedback:\n${message}`, `\nRating: ${rating ?? "N/A"}`, screenshotUrl ? `\nScreenshot data URL:\n${screenshotUrl}` : ""].join("\n"),
    });
    if (result.error) return NextResponse.json({ error: "Email send failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("feedback error", err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
