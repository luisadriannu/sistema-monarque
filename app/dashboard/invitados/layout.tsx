import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function InvitadosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.rol === "admin") redirect("/dashboard/usuarios");

  return children;
}
