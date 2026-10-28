"use client";

const pending = new Set<symbol>();
const listeners = new Set<() => void>();
export function beginNavigation() {
  const token = Symbol("navigation");
  pending.add(token);
  listeners.forEach(listener => listener());
  return () => {
    if (pending.delete(token)) listeners.forEach(listener => listener());
  };
}
export function subscribeNavigation(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const navigationPending = () => pending.size > 0;
export const navigationServerSnapshot = () => false;
