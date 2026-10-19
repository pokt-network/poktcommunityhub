import { HubPillNav } from "@/components/hub-pill-nav";
import { getSession } from "@/lib/session";

export async function HubPillNavServer({
  iconsOnly = false,
}: {
  iconsOnly?: boolean;
}) {
  const session = await getSession();
  const isAdmin = session?.user.role === "admin";

  return <HubPillNav iconsOnly={iconsOnly} isAdmin={isAdmin} />;
}
