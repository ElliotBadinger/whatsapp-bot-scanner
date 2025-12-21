import { cookies } from "next/headers";
import { AdminAuth } from "@/components/safemode/admin-auth";
import { AdminDashboard } from "@/components/safemode/admin-dashboard";
import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

export default async function AdminPage() {
  const config = getAdminAuthConfig();
  if (!config.ok) {
    return <AdminAuth />;
  }

  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) {
    return <AdminAuth />;
  }

  const session = verifyAdminSessionToken({
    token,
    secret: config.config.sessionSecret,
  });

  if (!session) {
    return <AdminAuth />;
  }

  return <AdminDashboard />;
}

export const dynamic = "force-dynamic";
