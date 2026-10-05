import type { Metadata } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Monarque | Plan Elite - Control de Invitaciones y Pases",
  description:
    "Sistema inteligente de gestión de pases y confirmaciones RSVP para invitaciones digitales exclusivas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-screen bg-[#faf8f5] text-stone-900 antialiased selection:bg-[#e8d7b5] selection:text-stone-900">
        {children}
      </body>
    </html>
  );
}
