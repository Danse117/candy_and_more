import { NextResponse } from "next/server";
import { auth } from "./server";

export async function requireAdminSession() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return {
      session: null as null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, response: null };
}
