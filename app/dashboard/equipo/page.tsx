import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import EquipoClient from "./EquipoClient";

export default async function EquipoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!["admin", "organizador"].includes(user.rol)) redirect("/dashboard");
  if (user.rol !== "admin" && !user.organizacion?.qr_checkin_habilitado) redirect("/dashboard/usuarios");
  return <EquipoClient isAdmin={user.rol === "admin"} />;
}
