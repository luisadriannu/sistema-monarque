import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.rol !== "clienta") redirect(user.rol === "recepcionista" ? "/dashboard/escanear" : "/dashboard/usuarios");

  return children;
}
