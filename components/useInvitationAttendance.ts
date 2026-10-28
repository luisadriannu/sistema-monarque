"use client";

import { useState } from "react";

export type InvitationAttendance = { pases_liberados?: boolean; pases_ingresados: number; pases_confirmados: number; confirmacion_bloqueada: boolean; escaneado: boolean };

// Updated only when a submitted confirmation is rejected by the server.
export default function useInvitationAttendance(token: string) {
  const [snapshot, setSnapshot] = useState<{ token: string; value: InvitationAttendance } | null>(null);
  const onRejected = (data: { code?: string; attendance?: InvitationAttendance }) => {
    if (data.code === "ATTENDANCE_LOCKED" && data.attendance) setSnapshot({ token, value: data.attendance });
  };
  return { attendance: snapshot?.token === token ? snapshot.value : null, onRejected };
}

