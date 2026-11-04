import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json({ error: "旧备考资料已归档" }, { status: 410 });
}
export const POST = GET;
