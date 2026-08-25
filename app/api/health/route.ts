import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Healthcheck Coolify. Doit répondre sans session et sans toucher la base. */
export function GET() {
  return NextResponse.json({ ok: true, service: "freelance-dashboard" });
}
