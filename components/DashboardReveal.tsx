"use client";

import { motion, useReducedMotion } from "motion/react";

export default function DashboardReveal({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      // No usar transformaciones aquí: un ancestro transformado cambia el bloque
      // de referencia de los modales `fixed` y evita que cubran el viewport completo.
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-full flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
