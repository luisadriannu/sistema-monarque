"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

export default function DashboardReveal({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = container.current;
    if (!root || reduceMotion || typeof Element.prototype.animate !== "function") return;
    const animations = new Set<Animation>();
    const cardSelector = 'article, [data-dashboard-reveal], :is(div, a, section, details)[class*="rounded-2xl"][class~="border"], :is(div, a, section, details)[class*="rounded-3xl"][class~="border"]';
    const selector = `h1, h2, tbody > tr, section, ${cardSelector}`;
    const seen = new WeakSet<HTMLElement>();
    const reveal = (nodes: HTMLElement[]) => {
      const candidates = new Set<HTMLElement>();
      for (const node of nodes) {
        if (node.matches(selector)) candidates.add(node);
        node.querySelectorAll<HTMLElement>(selector).forEach(child => candidates.add(child));
        if (!node.matches(selector) && !node.querySelector(selector) && node.matches("div") && node.children.length > 0) candidates.add(node);
      }
      let index = 0;
      for (const block of candidates) {
        if (seen.has(block) || !root.contains(block) || block.closest('[role="dialog"], [role="alertdialog"], [aria-live], [role="status"]')) continue;
        const style = getComputedStyle(block);
        if (style.position === "fixed" || style.position === "sticky" || block.querySelector('[role="dialog"], [role="alertdialog"], .fixed')) continue;
        // Cards enter as a whole, including their titles and contents.
        // Prefer the outer card so nested panels do not animate twice.
        const parentCard = block.parentElement?.closest(cardSelector);
        if (parentCard && root.contains(parentCard) && !parentCard.querySelector('[role="dialog"], [role="alertdialog"], .fixed')) continue;
        if (!block.matches(cardSelector) && block.querySelector(selector)) continue;
        seen.add(block);
        if (index >= 24) continue;
        const rect = block.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
        const animation = block.animate([
          { opacity: 0, transform: "translateY(16px) scale(0.985)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ], {
          duration: 480,
          delay: Math.min(index++ * 55, 275),
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "backwards",
        });
        animations.add(animation);
        animation.onfinish = () => { animations.delete(animation); animation.cancel(); };
      }
    };
    reveal(Array.from(root.children).filter((node): node is HTMLElement => node instanceof HTMLElement));
    const observer = new MutationObserver(records => {
      reveal(records.flatMap(record => Array.from(record.addedNodes))
        .filter((node): node is HTMLElement => node instanceof HTMLElement && root.contains(node)));
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      animations.forEach(animation => animation.cancel());
    };
  }, [reduceMotion]);

  return (
    <motion.div
      ref={container}
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
