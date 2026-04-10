import { NextRequest, NextResponse } from "next/server";
import { validateAdminToken } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  const user = await validateAdminToken(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const productId = formData.get("productId") as string | null;

  if (!file || !productId) {
    return NextResponse.json({ error: "Missing file or productId" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${productId}.${ext}`;
  const dir = path.join(process.cwd(), "public", "images");

  await mkdir(dir, { recursive: true });

  const bytes = await file.arrayBuffer();
  await writeFile(path.join(dir, filename), Buffer.from(bytes));

  const url = `/images/${filename}`;
  return NextResponse.json({ ok: true, url });
}
