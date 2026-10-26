import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import EquipoClient from "./EquipoClient";

export default async function EquipoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.rol !== "organizador") redirect("/dashboard");
  if (!user.organizacion?.qr_checkin_habilitado) redirect("/dashboard/usuarios");
  return <EquipoClient />;
}
