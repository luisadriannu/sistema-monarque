import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import DashboardNav from "@/components/DashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Obtener el evento del usuario para mostrar en el nav y contexto
  const evento = await prisma.evento.findFirst({
    where: user.rol === "admin" ? {} : { usuario_id: user.id },
    orderBy: { creado_en: "desc" },
  });

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 flex flex-col lg:flex-row">
      <DashboardNav user={user} eventSlug={evento?.slug} />
      <main className="flex-1 lg:pl-64 min-h-screen flex flex-col">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
