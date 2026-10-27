import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import UsuariosAdminClient from "../usuarios/UsuariosAdminClient";

export default async function ClientesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.rol !== "admin") redirect("/dashboard");
  return <UsuariosAdminClient isAdmin />;
}
