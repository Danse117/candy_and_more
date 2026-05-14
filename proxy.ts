import { auth } from "@/lib/auth/server";

export default auth.middleware({ loginUrl: "/admin/login" });

export const config = {
  matcher: [
    "/admin",
    "/admin/((?!login|forgot-password|reset-password).*)",
    "/api/admin/:path*",
  ],
};
