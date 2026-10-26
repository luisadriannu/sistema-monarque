import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import UsuariosAdminClient from "./UsuariosAdminClient";
import OrganizadoresAdminClient from "./OrganizadoresAdminClient";

export default async function UsuariosPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.rol === "clienta") redirect("/dashboard");
  if (user.rol === "recepcionista") redirect("/dashboard/escanear");

  return user.rol === "admin" ? <OrganizadoresAdminClient /> : <UsuariosAdminClient />;
}
