"use server";

import { auth } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export async function resetPassword(
  _prev: { error: string } | null | undefined,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const token = (formData.get("token") as string) || "";
  const password = (formData.get("password") as string) || "";
  const confirmPassword = (formData.get("confirmPassword") as string) || "";

  if (!token) return { error: "Reset token missing. Request a new reset link." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  const { error } = await auth.resetPassword({ newPassword: password, token });
  if (error) {
    return { error: error.message || "Failed to reset password." };
  }

  redirect("/admin/login");
}
