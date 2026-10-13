import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  getAppPassword,
  sessionCookieOptions,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = body.password ?? "";
  } catch {
    return NextResponse.json({ error: "请求无效" }, { status: 400 });
  }

  if (!password || password !== getAppPassword()) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieOptions(token));
  return response;
}
