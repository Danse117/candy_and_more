import type { NextRequest } from "next/server";

interface NetlifyIdentityUser {
  sub: string;
  email: string;
  app_metadata?: {
    roles?: string[];
  };
}

export async function validateAdminToken(request: NextRequest): Promise<NetlifyIdentityUser | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);

  try {
    // Decode JWT payload (Netlify Identity tokens are JWTs)
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) return null;

    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64").toString("utf-8")
    ) as NetlifyIdentityUser;

    // Check for admin role
    const roles = payload.app_metadata?.roles || [];
    if (!roles.includes("admin")) return null;

    return payload;
  } catch {
    return null;
  }
}
