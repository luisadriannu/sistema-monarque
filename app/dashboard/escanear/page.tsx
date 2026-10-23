import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import EntradaScanner from "./EntradaScanner";

export default async function EscanearPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.rol !== "organizador") redirect("/dashboard");
  if (!user.organizacion?.qr_checkin_habilitado) redirect("/dashboard/usuarios");
  return <EntradaScanner />;
}
