type SavedRsvp = {
  estado: string;
  pases_confirmados: number | null;
  ninos_confirmados?: number;
};

export function isRsvpUnchanged(saved: SavedRsvp, passes: number, children: number) {
  const status = passes === 0 ? "declinado" : "confirmado";
  return saved.estado === status
    && (saved.pases_confirmados ?? 0) === passes
    && (saved.ninos_confirmados ?? 0) === (passes > 0 ? children : 0);
}
