import { auth } from "@/lib/auth/server";
import AdminShell from "@/components/custom/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = await auth.getSession();

  // The proxy redirects ALL unauthenticated /admin/* requests to /admin/login
  // BEFORE this layout runs. So the only way to reach this code path without
  // a session is the login page itself. In that case, render children plain
  // (no sidebar/shell).
  if (!session?.user) {
    return <>{children}</>;
  }

  return <AdminShell>{children}</AdminShell>;
}
