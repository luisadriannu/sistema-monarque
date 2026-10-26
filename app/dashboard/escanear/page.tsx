import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import EntradaScanner from "./EntradaScanner";

export default async function EscanearPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!["organizador", "recepcionista"].includes(user.rol)) redirect("/dashboard");
  if (!user.organizacion?.qr_checkin_habilitado) redirect("/dashboard/usuarios");
  if (user.rol === "recepcionista" && !user.lector_qr_habilitado) redirect("/dashboard/cuenta");
  return <EntradaScanner canManageReception={user.rol === "organizador"} />;
}
