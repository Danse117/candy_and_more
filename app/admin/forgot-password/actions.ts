"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";

export async function requestPasswordReset(
  _prev: { error?: string; sent?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; sent?: boolean }> {
  const email = (formData.get("email") as string) || "";
  if (!email) return { error: "Email is required." };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const redirectTo = `${proto}://${host}/admin/reset-password`;

  const { error } = await auth.requestPasswordReset({ email, redirectTo });
  if (error) {
    return { error: error.message || "Failed to send reset email." };
  }

  return { sent: true };
}
