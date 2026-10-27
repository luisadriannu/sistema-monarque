import DashboardReveal from "@/components/DashboardReveal";

export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardReveal>{children}</DashboardReveal>;
}
