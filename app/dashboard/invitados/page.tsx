"use client";
import { recoveredPasses, releasablePasses } from "@/lib/pass-balance";
import { hasAttendance, attendanceLockMessage } from "@/lib/attendance-lock";
import ModalHeader from "@/components/ModalHeader";
import {
  isValidName,
  lettersOnly,
  nameInputProps,
  NAME_ERROR,
} from "@/lib/names";
import AsyncButton from "@/components/AsyncButton";
import FloatingMenu from "@/components/FloatingMenu";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Filter,
  UserPlus,
  FileSpreadsheet,
  Copy,
  Check,
  RefreshCw,
  RotateCcw,
  Edit2,
  Trash2,
  X,
  Upload,
  AlertCircle,
  CheckCircle,
  MessageCircle,
  Download,
  FileUp,
  MoreVertical,
  ExternalLink,
  Send,
  Eye,
  FileText,
  LockKeyhole,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateTimeMx, formatDateMx, formatDateLongMx } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import usePanelDialog from "@/components/usePanelDialog";

interface Invitado {
  id: string;
  nombre: string;
  grupo: string | null;
  pases_asignados: number;
  pases_confirmados: number | null;
  ninos_confirmados: number;
  estado: "pendiente" | "visto" | "confirmado" | "declinado";
  token: string;
  enviado_en: string | null;
  ultima_respuesta_en: string | null;
  pases_ingresados: number;
  pases_liberados?: boolean;
  ultima_entrada_en: string | null;
  creado_en: string;
}

interface Evento {
  id: string;
  slug: string;
  nombre: string;
  anfitriones: string;
  fecha_evento: string;
  lugar: string;
  capacidad_total: number | null;
  fecha_limite_rsvp: string;
  texto_edad_nino?: string;
  plantilla_mensaje: string;
  plantilla_recordatorio?: string;
}

type Toast = {
  type: "success" | "error";
  title: string;
  message: string;
};

function InvitadosContent() {
  const router = useRouter();
  const { confirmDialog, notify, dialog } = usePanelDialog();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const estadoParam = searchParams.get("estado");
  const entradaParam = searchParams.get("entrada");
  const eventoIdParam = searchParams.get("evento_id");
  const permisoScope = eventoIdParam || "evento-propio";

  const [evento, setEvento] = useState<Evento | null>(null);
  const [invitados, setInvitados] = useState<Invitado[]>([]);
  const [loading, setLoading] = useState(true);
  // Los permisos empiezan cerrados para evitar mostrar acciones de escritura
  // antes de que el servidor confirme el estado real del evento.
  const [soloLectura, setSoloLectura] = useState(true);
  const [permisoScopeResuelto, setPermisoScopeResuelto] = useState<
    string | null
  >(null);
  const [vistaAdmin, setVistaAdmin] = useState(false);
  const permisosResueltos = permisoScopeResuelto === permisoScope;
  const puedeModificar = permisosResueltos && !soloLectura;
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setClockNow(Date.now());
    const timer = window.setInterval(update, 10000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);
  const altasCerradas = Boolean(evento && clockNow > new Date(evento.fecha_limite_rsvp).getTime());
  const puedeAgregar = puedeModificar && !altasCerradas;

  // Filtros (conectados con la URL al hacer clic desde el dashboard)
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState(estadoParam || "todos");
  const [filtroEntrada, setFiltroEntrada] = useState(entradaParam || "todos");
  const [qrCheckinEnabled, setQrCheckinEnabled] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 25,
    total: 0,
    total_pages: 1,
  });
  const [totalPasesAsignados, setTotalPasesAsignados] = useState(0);
  const [limiteInvitados, setLimiteInvitados] = useState<number | null>(null);
  const [totalInvitadosEvento, setTotalInvitadosEvento] = useState(0);
  const [limitePases, setLimitePases] = useState<number | null>(null);
  const [pasesContratados, setPasesContratados] = useState<number | null>(null);
  const limiteInvitadosAlcanzado =
    (limiteInvitados !== null && totalInvitadosEvento >= limiteInvitados) ||
    (limitePases !== null && totalPasesAsignados >= limitePases);

  useEffect(() => {
    const estado = searchParams.get("estado");
    const entrada = searchParams.get("entrada");
    if (estado) {
      setFiltroEstado(estado);
      setPage(1);
    }
    if (entrada) {
      setFiltroEntrada(entrada);
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Modales
  const [modalAgregar, setModalAgregar] = useState(false);
  const [modalEditar, setModalEditar] = useState<Invitado | null>(null);
  const [modalImportar, setModalImportar] = useState(false);
  const [modalEliminar, setModalEliminar] = useState<Invitado | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Menú de opciones abierto por fila (id de invitado)
  const [menuAbiertoId, setMenuAbiertoId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLButtonElement | null>(null);

  // Formulario Agregar / Editar
  const [formNombre, setFormNombre] = useState("");
  const [formGrupo, setFormGrupo] = useState("");
  const [formPases, setFormPases] = useState("2");
  const [guardando, setGuardando] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const formPasesNumero = Number(formPases);
  const formPasesValido = /^\d+$/.test(formPases) && formPasesNumero >= 1;
  const newGuestLimit = pasesContratados ?? limitePases;
  const newGuestExceedsContract = newGuestLimit !== null && totalPasesAsignados + formPasesNumero > newGuestLimit;

  const handleCambiarPases = (value: string) => {
    if (/^\d*$/.test(value)) {
      setFormPases(value);
      if (formError) setFormError(null);
    }
  };

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Importación masiva
  const [filasImportadas, setFilasImportadas] = useState<
    Array<{
      nombre: string;
      pases_asignados: number;
      grupo: string;
      valido: boolean;
      error?: string;
    }>
  >([]);
  const [resumenImportacion, setResumenImportacion] = useState<{
    total: number;
    validos: number;
    invalidos: number;
  } | null>(null);
  const [importando, setImportando] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [archivoError, setArchivoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Feedback de copiado
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Cargar lista de invitados
  const listRequest = useRef(0);
  useEffect(() => () => { listRequest.current += 1; }, []);
  const fetchInvitados = useCallback(
    async (targetPage = page) => {
      const requestId = ++listRequest.current;
      setLoading(true);
      try {
        const query = new URLSearchParams({
          page: String(targetPage),
          page_size: String(pageSize),
          estado: filtroEstado,
          entrada: filtroEntrada,
        });
        if (eventoIdParam) query.set("evento_id", eventoIdParam);
        if (debouncedSearch) query.set("search", debouncedSearch);

        const res = await fetch(`/api/invitados?${query.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (requestId !== listRequest.current) return;
        if (!res.ok) throw new Error(data.error || "No se pudo actualizar la lista de invitados.");
        if (res.ok) {
          setEvento(data.evento);
          setInvitados(data.invitados || []);
          setSoloLectura(Boolean(data.solo_lectura));
          setVistaAdmin(Boolean(data.vista_admin));
          setQrCheckinEnabled(Boolean(data.permisos?.qr_checkin_habilitado));
          setLimiteInvitados(
            typeof data.permisos?.limite_invitados === "number"
              ? data.permisos.limite_invitados
              : null,
          );
          setPasesContratados(data.permisos?.limite_pases_contratados ?? data.permisos?.limite_pases ?? null);
          setLimitePases(
            typeof data.permisos?.limite_pases === "number"
              ? data.permisos.limite_pases
              : null,
          );
          setPermisoScopeResuelto(permisoScope);
          setPagination(
            data.pagination || {
              page: 1,
              page_size: pageSize,
              total: 0,
              total_pages: 1,
            },
          );
          setPage(data.pagination?.page || 1);
          setTotalPasesAsignados(
            data.kpis?.total_asignados || 0,
          );
          setTotalInvitadosEvento(data.kpis?.total_invitados || 0);
          return true;
        }
      } catch (e) {
        if (requestId !== listRequest.current) return;
        console.error("Error al cargar invitados", e);
        setToast({ type: "error", title: "No se pudo actualizar la lista", message: e instanceof Error ? e.message : "Intenta actualizar la lista nuevamente." });
        return false;
      } finally {
        if (requestId === listRequest.current) setLoading(false);
      }
    },
    [
      debouncedSearch,
      eventoIdParam,
      filtroEntrada,
      filtroEstado,
      page,
      pageSize,
      permisoScope,
    ],
  );

  useEffect(() => {
    fetchInvitados();
  }, [fetchInvitados]);

  const focusRefresh = useRef({ last: 0, pending: false });
  useEffect(() => {
    if (!qrCheckinEnabled) return;
    const refreshOnFocus = () => {
      if (document.visibilityState !== "visible" || focusRefresh.current.pending || Date.now() - focusRefresh.current.last < 15000) return;
      focusRefresh.current.last = Date.now();
      focusRefresh.current.pending = true;
      void fetchInvitados().finally(() => { focusRefresh.current.pending = false; });
    };
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [fetchInvitados, qrCheckinEnabled]);

  // Si cambia el evento consultado, ocultamos inmediatamente cualquier acción
  // mutable hasta validar los permisos del nuevo evento.
  useEffect(() => {
    setPermisoScopeResuelto(null);
    setSoloLectura(true);
    setModalAgregar(false);
    setModalEditar(null);
    setModalImportar(false);
    setModalEliminar(null);
    setMenuAbiertoId(null);
  }, [eventoIdParam]);

  // Cierra cualquier modal que se hubiera abierto si el servidor informa que
  // el evento ya se encuentra en modo de solo lectura.
  useEffect(() => {
    if (!permisosResueltos || !soloLectura) return;
    setModalAgregar(false);
    setModalEditar(null);
    setModalImportar(false);
    setModalEliminar(null);
    setMenuAbiertoId(null);
  }, [permisosResueltos, soloLectura]);

  // Cerrar modales con tecla Escape y cerrar menú de opciones al hacer clic afuera
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalAgregar(false);
        setModalEditar(null);
        setModalImportar(false);
        if (!eliminando) setModalEliminar(null);
        setMenuAbiertoId(null);
      }
    };
    const handleClickAfuera = () => setMenuAbiertoId(null);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleClickAfuera);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClickAfuera);
    };
  }, [eliminando]);

  // Generar link completo
  const getInvitationUrl = (token: string) => {
    if (typeof window === "undefined" || !evento) return "";
    return `${window.location.origin}/${evento.slug}?id=${token}`;
  };

  // Construir mensaje para WhatsApp o Copiar con variables neutras
  const getArmadoMensaje = (invitado: Invitado) => {
    if (!evento) return "";
    const plantilla =
      evento.plantilla_mensaje ||
      "¡Hola {nombre}! Te invitamos con mucho cariño a nuestro evento. Tienes {pases} pases reservados. Por favor confírmanos tu asistencia aquí: {link}";
    const link = getInvitationUrl(invitado.token);

    return plantilla
      .replace(/{nombre}/g, invitado.nombre)
      .replace(/{pases}/g, String(invitado.pases_asignados))
      .replace(/{link}/g, link)
      .replace(/{fecha_limite}/g, formatDateMx(evento.fecha_limite_rsvp));
  };

  // Registrar automáticamente que el link fue enviado
  const registrarEnvio = async (invitadoId: string) => {
    try {
      const res = await fetch(`/api/invitados/${invitadoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "marcar_enviado" }),
      });
      if (res.ok) {
        const data = await res.json();
        setInvitados((prev) =>
          prev.map((i) =>
            i.id === invitadoId ? { ...i, enviado_en: data.enviado_en } : i,
          ),
        );
      }
    } catch (e) {
      console.error("Error al registrar envío", e);
    }
  };

  // Copiar mensaje
  const handleCopiarMensaje = async (invitado: Invitado) => {
    const texto = getArmadoMensaje(invitado);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoId(invitado.id);
      setTimeout(() => setCopiadoId(null), 2500);
      await registrarEnvio(invitado.id);
    } catch (e) {
      console.error("Error al copiar texto", e);
    }
  };

  // Abrir WhatsApp
  const handleAbrirWhatsApp = async (invitado: Invitado) => {
    const texto = getArmadoMensaje(invitado);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
    await registrarEnvio(invitado.id);
  };

  const handleLiberarPases = async (inv: Invitado) => {
    if (!(await confirmDialog(`¿Liberar los ${inv.pases_asignados} pases de ${inv.nombre}? Su confirmación quedará cerrada y no podrá volver a aceptar la invitación.`))) return;
    const response = await fetch(`/api/invitados/${inv.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "liberar_pases" }) });
    const data = await response.json();
    notify(response.ok ? data.message : data.error);
    if (response.ok) { await fetchInvitados(); router.refresh(); }
  };

  // Regenerar link
  const handleRegenerarLink = async (invitado: Invitado) => {
    if (altasCerradas) { notify("El plazo de confirmación ha cerrado. No se puede reiniciar la confirmación regenerando el enlace."); return; }
    if (hasAttendance(invitado)) { notify(attendanceLockMessage); return; }
    if (regeneratingId) return;
    setRegeneratingId(invitado.id);
    try {
      if (
        !(await confirmDialog(
          `¿Regenerar el enlace de ${invitado.nombre}? El enlace y QR anteriores dejarán de funcionar. Su estado volverá a Pendiente, se borrará su confirmación y tendrás que compartir el nuevo enlace. Los ingresos registrados en recepción se conservarán.`,
        ))
      )
        return;
      const response = await fetch(`/api/invitados/${invitado.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerar_link" }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "No se pudo regenerar el enlace.");
      await fetchInvitados();
      notify(
        data.message ||
          "Enlace regenerado con éxito. Recuerda compartir el nuevo enlace.",
      );
    } catch (error) {
      setToast({
        type: "error",
        title: "No se pudo regenerar el enlace",
        message: error instanceof Error ? error.message : "Inténtalo de nuevo.",
      });
    } finally {
      setRegeneratingId(null);
    }
  };

  // Guardar nuevo invitado
  const handleGuardarNuevo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    if (!evento || !puedeAgregar || Date.now() > new Date(evento.fecha_limite_rsvp).getTime()) {
      setModalAgregar(false);
      return;
    }
    if (limiteInvitadosAlcanzado) {
      setFormError(
        limitePases !== null && totalPasesAsignados >= limitePases
          ? `Alcanzaste el límite contratado de ${limitePases} pases.`
          : `Alcanzaste el límite de ${limiteInvitados} invitaciones para este evento.`,
      );
      return;
    }
    setFormError(null);

    if (!formPasesValido) {
      setFormError(
        "Los pases asignados deben ser un número mayor o igual a 1.",
      );
      return;
    }
    if (newGuestExceedsContract) {
      setFormError(`Solo quedan ${Math.max(0, (newGuestLimit ?? 0) - totalPasesAsignados)} pases disponibles dentro del contrato.`);
      return;
    }

    setGuardando(true);

    try {
      const res = await fetch("/api/invitados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento_id: evento.id,
          nombre: formNombre,
          grupo: formGrupo,
          pases_asignados: formPasesNumero,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al agregar invitado.");

      setPage(1);
      const refreshed = await fetchInvitados(1);
      router.refresh();
      setModalAgregar(false);
      setFormNombre("");
      setFormGrupo("");
      setFormPases("2");
      setToast({
        type: refreshed === false ? "error" : "success",
        title: refreshed === false ? "Invitado guardado; lista pendiente de actualizar" : "Invitado agregado",
        message: refreshed === false ? `${data.invitado.nombre} ya está guardado. Actualiza la lista; no necesitas agregarlo otra vez.` : `${data.invitado.nombre} se guardó correctamente.${data.capacidad_actualizada ? ` Capacidad actualizada a ${data.capacidad_total} asientos.` : ""}${debouncedSearch || filtroEstado !== "todos" || filtroEntrada !== "todos" ? " Si no aparece, revisa los filtros o la búsqueda activos." : ""}`,
      });
    } catch (err: unknown) {
      if (err instanceof Error) setFormError(err.message);
      else setFormError("Error inesperado al guardar.");
    } finally {
      setGuardando(false);
    }
  };

  // Abrir modal editar
  const handleAbrirEditar = (inv: Invitado) => {
    if (!puedeModificar) return;
    setModalEditar(inv);
    setFormNombre(inv.nombre);
    setFormGrupo(inv.grupo || "");
    setFormPases(String(inv.pases_asignados));
    setFormError(null);
    setMenuAbiertoId(null);
  };

  // Guardar edición
  const handleGuardarEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    if (!modalEditar || !puedeModificar) {
      setModalEditar(null);
      return;
    }
    setFormError(null);

    if (!formPasesValido) {
      setFormError(
        "Los pases asignados deben ser un número mayor o igual a 1.",
      );
      return;
    }

    setGuardando(true);

    if (
      modalEditar.pases_confirmados !== null &&
      formPasesNumero < modalEditar.pases_confirmados
    ) {
      const confirmar = await confirmDialog(
        `Atención: El invitado ya tiene ${modalEditar.pases_confirmados} pases confirmados. Al reducir los pases a ${formPasesNumero}, su confirmación y desglose de niños se ajustarán automáticamente al nuevo límite. ¿Deseas continuar?`,
      );
      if (!confirmar) {
        setGuardando(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/invitados/${modalEditar.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: formNombre,
          grupo: formGrupo,
          pases_asignados: formPasesNumero,
        }),
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Error al actualizar invitado.");

      setModalEditar(null);
      await fetchInvitados();
      setToast({
        type: "success",
        title: "Cambios guardados",
        message:
          data.aviso || `${formNombre.trim()} se actualizó correctamente.`,
      });
    } catch (err: unknown) {
      if (err instanceof Error) setFormError(err.message);
      else setFormError("Error inesperado al guardar.");
    } finally {
      setGuardando(false);
    }
  };

  // Eliminar invitado
  const handleConfirmarEliminar = async () => {
    if (!modalEliminar || eliminando || !puedeModificar) {
      setModalEliminar(null);
      return;
    }
    const nombreEliminado = modalEliminar.nombre;
    setEliminando(true);
    try {
      const res = await fetch(`/api/invitados/${modalEliminar.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "No se pudo eliminar al invitado.");

      await fetchInvitados();
      setModalEliminar(null);
      setToast({
        type: "success",
        title: "Invitado eliminado",
        message: `${nombreEliminado} se eliminó correctamente.`,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Ocurrió un error al eliminar.";
      setToast({ type: "error", title: "No se pudo eliminar", message });
    } finally {
      setEliminando(false);
    }
  };

  // Procesar archivo Excel o CSV
  const procesarArchivo = async (file: File) => {
    if (!file) return;
    setArchivoError(null);
    setNombreArchivo(file.name);

    const extension = file.name.split(".").pop()?.toLowerCase();

    try {
      if (extension === "csv") {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            procesarFilasImportadas(results.data as Record<string, unknown>[]);
          },
          error: (err) => {
            setArchivoError("Error al leer el archivo CSV: " + err.message);
          },
        });
      } else if (extension === "xlsx" || extension === "xls") {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
        procesarFilasImportadas(data);
      } else {
        setArchivoError(
          `Formato ".${extension}" no compatible. Por favor sube un archivo Excel (.xlsx, .xls) o CSV (.csv).`,
        );
      }
    } catch (err: unknown) {
      console.error("Error al procesar archivo:", err);
      setArchivoError(
        "No se pudo leer el archivo. Asegúrate de que no esté abierto en otro programa ni protegido con contraseña.",
      );
    }
  };

  const handleArchivoSeleccionado = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) procesarArchivo(file);
    e.target.value = "";
  };

  const procesarFilasImportadas = (data: Record<string, unknown>[]) => {
    if (!data || data.length === 0) {
      setArchivoError(
        "El archivo parece estar vacío o no contiene filas con datos.",
      );
      return;
    }

    const procesadas = data.map((fila) => {
      const keys = Object.keys(fila);
      const nombreKey = keys.find((k) =>
        /^(nombre|invitado|familia|name)/i.test(k.trim()),
      );
      const pasesKey = keys.find((k) =>
        /^(pases|pases_asignados|boletos|lugares|personas|tickets)/i.test(
          k.trim(),
        ),
      );
      const grupoKey = keys.find((k) =>
        /^(grupo|categoria|categoría|familia de|mesa|group)/i.test(k.trim()),
      );

      const nombre = String((nombreKey ? fila[nombreKey] : "") || "").trim();
      const pasesRaw = pasesKey ? fila[pasesKey] : "1";
      const grupo = String((grupoKey ? fila[grupoKey] : "") || "").trim();

      const pasesNum = parseInt(String(pasesRaw ?? "1"), 10);
      const valido = Boolean(
        isValidName(nombre) && !isNaN(pasesNum) && pasesNum >= 1,
      );

      let error = undefined;
      if (!isValidName(nombre)) error = NAME_ERROR;
      else if (isNaN(pasesNum) || pasesNum < 1)
        error = "Pases inválidos (mínimo 1)";

      return {
        nombre,
        pases_asignados: isNaN(pasesNum) || pasesNum < 1 ? 1 : pasesNum,
        grupo,
        valido,
        error,
      };
    });

    const validos = procesadas.filter((f) => f.valido).length;
    const invalidos = procesadas.length - validos;

    setFilasImportadas(procesadas);
    setResumenImportacion({
      total: procesadas.length,
      validos,
      invalidos,
    });
  };

  // Descargar plantilla de ejemplo
  const handleDescargarPlantilla = (formato: "xlsx" | "csv") => {
    const ejemplo = [
      { nombre: "Familia Gómez Pérez", pases: 4, grupo: "Familia de la Novia" },
      {
        nombre: "Carlos Mendoza y Acompañante",
        pases: 2,
        grupo: "Amigos de Luis",
      },
      { nombre: "Dra Sofía Alarcón", pases: 1, grupo: "Colegas" },
      {
        nombre: "Familia Treviño Morales",
        pases: 3,
        grupo: "Familia del Novio",
      },
    ];

    if (formato === "xlsx") {
      const ws = XLSX.utils.json_to_sheet(ejemplo);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Invitados");
      XLSX.writeFile(wb, "Plantilla_Invitados_Monarque.xlsx");
    } else {
      const csv = Papa.unparse(ejemplo);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Plantilla_Invitados_Monarque.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Guardar importación masiva
  const handleGuardarImportacion = async () => {
    if (importando) return;
    if (!puedeAgregar || !evento || Date.now() > new Date(evento.fecha_limite_rsvp).getTime()) {
      setModalImportar(false);
      return;
    }
    if (!evento || !resumenImportacion || resumenImportacion.validos === 0)
      return;
    if (
      limiteInvitados !== null &&
      totalInvitadosEvento + resumenImportacion.validos > limiteInvitados
    ) {
      setArchivoError(
        `No puedes importar ${resumenImportacion.validos} registros: quedan ${Math.max(0, limiteInvitados - totalInvitadosEvento)} espacios disponibles.`,
      );
      return;
    }
    const pasesImportados = filasImportadas.filter((fila) => fila.valido).reduce((total, fila) => total + fila.pases_asignados, 0);
    if (limitePases !== null && totalPasesAsignados + pasesImportados > limitePases) {
      setArchivoError(`La importación supera el límite contratado. Quedan ${Math.max(0, limitePases - totalPasesAsignados)} pases disponibles.`);
      return;
    }
    setImportando(true);

    try {
      const validas = filasImportadas.filter((f) => f.valido);
      const res = await fetch("/api/invitados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento_id: evento.id,
          bulk: true,
          invitados: validas,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setArchivoError(data.error || "No se pudieron importar los invitados.");
      } else {
        setModalImportar(false);
        setFilasImportadas([]);
        setResumenImportacion(null);
        setPage(1);
        await fetchInvitados(1);
        notify(`¡Se importaron ${validas.length} invitados correctamente!`);
      }
    } catch (e) {
      console.error("Error al importar", e);
    } finally {
      setImportando(false);
    }
  };

  const fetchConfirmadosParaExportar = async (): Promise<Invitado[]> => {
    if (!evento) return [];
    const query = new URLSearchParams({
      evento_id: evento.id,
      estado: "confirmado",
      all: "true",
    });
    const response = await fetch(`/api/invitados?${query.toString()}`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "No se pudo preparar la exportación.");
    }
    return data.invitados || [];
  };

  // EXPORTAR: Lista de confirmados a Excel (.xlsx) (RF-31, RF-32)
  const handleExportarExcelConfirmados = async () => {
    if (!evento) return;
    let confirmados: Invitado[] = [];
    try {
      confirmados = await fetchConfirmadosParaExportar();
    } catch (exportError) {
      setToast({
        type: "error",
        title: "No se pudo exportar",
        message:
          exportError instanceof Error
            ? exportError.message
            : "No se pudo preparar la lista de confirmados.",
      });
      return;
    }
    if (confirmados.length === 0) {
      notify("Aún no tienes invitados confirmados para exportar.");
      return;
    }

    const criterioNino = evento.texto_edad_nino || "menores de 12 años";
    const columnaNinos = `Niños (${criterioNino})`;

    let totalAdultos = 0;
    let totalNinos = 0;
    let totalAsistentes = 0;

    const filas = confirmados.map((inv, index) => {
      const conf = inv.pases_confirmados || 0;
      const ninos = inv.ninos_confirmados || 0;
      const adultos = Math.max(0, conf - ninos);

      totalAdultos += adultos;
      totalNinos += ninos;
      totalAsistentes += conf;

      return {
        "#": index + 1,
        "Invitado / Familia": inv.nombre,
        Grupo: inv.grupo || "General",
        Adultos: adultos,
        [columnaNinos]: ninos,
        "Total de Asistentes": conf,
        "Fecha de Confirmación": formatDateTimeMx(inv.ultima_respuesta_en),
      };
    });

    filas.push({
      "#": "" as unknown as number,
      "Invitado / Familia": "TOTAL GENERAL",
      Grupo: "",
      Adultos: totalAdultos,
      [columnaNinos]: totalNinos,
      "Total de Asistentes": totalAsistentes,
      "Fecha de Confirmación": "",
    });

    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Confirmados");
    XLSX.writeFile(
      wb,
      `Lista_Confirmados_${evento.nombre.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`,
    );
  };

  // EXPORTAR: Lista de confirmados a PDF (RF-31, RF-32)
  const handleExportarPDFConfirmados = async () => {
    if (!evento) return;
    let confirmados: Invitado[] = [];
    try {
      confirmados = await fetchConfirmadosParaExportar();
    } catch (exportError) {
      setToast({
        type: "error",
        title: "No se pudo exportar",
        message:
          exportError instanceof Error
            ? exportError.message
            : "No se pudo preparar la lista de confirmados.",
      });
      return;
    }
    if (confirmados.length === 0) {
      notify("Aún no tienes invitados confirmados para exportar.");
      return;
    }

    const criterioNino = evento.texto_edad_nino || "menores de 12 años";

    let totalAdultos = 0;
    let totalNinos = 0;
    let totalAsistentes = 0;

    confirmados.forEach((inv) => {
      const conf = inv.pases_confirmados || 0;
      const ninos = inv.ninos_confirmados || 0;
      const adultos = Math.max(0, conf - ninos);
      totalAdultos += adultos;
      totalNinos += ninos;
      totalAsistentes += conf;
    });

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Encabezado más grande y notorio
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(43, 33, 27);
    doc.text("MONARQUE • LISTA DE CONFIRMADOS", 14, 19);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    doc.text("Lista oficial de asistentes confirmados", 14, 26);

    doc.setDrawColor(224, 90, 27);
    doc.setLineWidth(0.6);
    doc.line(14, 30, 196, 30);

    // Datos del Evento en tamaño 10.5pt (más legible y espaciado)
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(43, 33, 27);
    doc.text(`Evento: ${evento.nombre}`, 14, 38);
    doc.text(`Anfitriones: ${evento.anfitriones}`, 14, 45);
    doc.text(`Fecha: ${formatDateLongMx(evento.fecha_evento)}`, 14, 52);

    // Lugar multilínea para que no se corte ni colisione con la caja derecha
    const lugarTexto = `Lugar: ${evento.lugar}`;
    const lugarLineas = doc.splitTextToSize(lugarTexto, 96);
    doc.text(lugarLineas, 14, 59);

    // Caja de Resumen Destacada más amplia y visible (Lado derecho, x=114, y=34, w=82, h=36)
    doc.setFillColor(251, 248, 244);
    doc.setDrawColor(235, 217, 196);
    doc.setLineWidth(0.4);
    doc.roundedRect(114, 34, 82, 36, 3, 3, "FD");

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(224, 90, 27);
    doc.text("TOTAL ASISTENTES CONFIRMADOS", 120, 41);

    doc.setFontSize(17);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(43, 33, 27);
    doc.text(
      `${totalAsistentes} ${totalAsistentes === 1 ? "persona" : "personas"}`,
      120,
      50,
    );

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 40, 35);
    const labelAdultos = `${totalAdultos} ${totalAdultos === 1 ? "adulto" : "adultos"}`;
    const labelNinos = `${totalNinos} ${totalNinos === 1 ? "niño" : "niños"}`;
    doc.text(`${labelAdultos}  ·  ${labelNinos}`, 120, 58);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 85, 35);
    doc.text(`* Criterio niños: ${criterioNino}`, 120, 64.5);

    const startYTable = Math.max(74, 59 + lugarLineas.length * 5 + 6);

    const bodyData = confirmados.map((inv, idx) => {
      const conf = inv.pases_confirmados || 0;
      const ninos = inv.ninos_confirmados || 0;
      const adultos = Math.max(0, conf - ninos);
      return [
        idx + 1,
        inv.nombre,
        inv.grupo || "-",
        adultos,
        ninos,
        `${conf} ${conf === 1 ? "persona" : "personas"}`,
        formatDateTimeMx(inv.ultima_respuesta_en),
      ];
    });

    const headerNinos = `Niños (${criterioNino})`;

    autoTable(doc, {
      startY: startYTable,
      margin: { left: 14, right: 14 },
      head: [
        [
          "#",
          "Invitado / Familia",
          "Grupo",
          "Adultos",
          headerNinos,
          "Total Asistentes",
          "Fecha Confirmación",
        ],
      ],
      body: bodyData,
      theme: "striped",
      headStyles: {
        fillColor: [43, 33, 27],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9.5,
        cellPadding: 3.5,
      },
      styles: {
        fontSize: 9.5,
        cellPadding: 3.5,
        textColor: [45, 35, 30],
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { cellWidth: 46 },
        2: { cellWidth: 32 },
        3: { halign: "center", cellWidth: 18 },
        4: { halign: "center", cellWidth: 28 },
        5: { halign: "center", cellWidth: 24 },
        6: { halign: "left", cellWidth: 24 },
      },
      foot: [
        [
          "",
          "TOTAL GENERAL",
          "",
          `${totalAdultos}`,
          `${totalNinos}`,
          `${totalAsistentes} personas`,
          "",
        ],
      ],
      footStyles: {
        fillColor: [245, 237, 226],
        textColor: [43, 33, 27],
        fontStyle: "bold",
        fontSize: 10,
        cellPadding: 3.5,
      },
    });

    // Nota al pie para el salón / banquete
    const finalY =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY || 200;
    if (finalY < 275) {
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(90, 80, 75);
      doc.text(
        `* Especificación para salón y servicio de banquete: Se consideran niños a ${criterioNino}.`,
        14,
        finalY + 8,
      );
    }

    doc.save(
      `Lista_Confirmados_${evento.nombre.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
    );
  };

  // Helper de badges de estado (con distinción de Confirmado total vs Parcial)
  const renderBadgeEstado = (inv: Invitado) => {
    if (inv.estado === "confirmado") {
      const conf = inv.pases_confirmados || 0;
      if (conf < inv.pases_asignados) {
        return (
          <span
            title={`Confirmó ${conf} de ${inv.pases_asignados} pases. Liberó ${inv.pases_asignados - conf} ${
              inv.pases_asignados - conf === 1 ? "pase" : "pases"
            }`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Parcial
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          Confirmado
        </span>
      );
    }
    if (inv.estado === "declinado") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
          Declinado
        </span>
      );
    }
    if (inv.estado === "visto") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
          Visto
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
        <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
        Pendiente
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {dialog}
      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end"
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence mode="wait">
          {toast && (
            <motion.div
              key={`${toast.type}-${toast.title}-${toast.message}`}
              role={toast.type === "error" ? "alert" : "status"}
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -18, scale: 0.96 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -10, scale: 0.97 }
              }
              transition={{
                duration: reduceMotion ? 0.12 : 0.25,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-white p-4 shadow-[0_18px_50px_rgba(41,30,22,.18)] sm:w-[23rem] ${
                toast.type === "success"
                  ? "border-emerald-200"
                  : "border-rose-200"
              }`}
            >
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  toast.type === "success"
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {toast.type === "success" ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-stone-900">
                  {toast.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-stone-600">
                  {toast.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="Cerrar notificación"
                className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cabecera Principal con Descargas de Confirmados integradas */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-[#f5ede2]">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2b211b]">
            Invitados
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Control de pases y enlaces individuales para tus invitados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botones de Descargar Confirmados */}
          <div className="flex items-center bg-[#fbf8f4] p-1 rounded-xl border border-[#ebd9c4]">
            <span className="text-[11px] font-bold text-[#86583d] uppercase tracking-wider px-2 hidden sm:inline">
              Confirmados:
            </span>
            <AsyncButton
              onClick={handleExportarExcelConfirmados}
              title="Descargar lista de confirmados en Excel"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-emerald-50 text-stone-800 hover:text-emerald-700 text-xs font-semibold rounded-lg border border-stone-200 transition-colors shadow-xs"
              loadingText="Exportando…"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </AsyncButton>
            <AsyncButton
              onClick={handleExportarPDFConfirmados}
              title="Descargar lista de confirmados en PDF"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-[#ffedd5] text-stone-800 hover:text-[#c2410c] text-xs font-semibold rounded-lg border border-stone-200 transition-colors shadow-xs ml-1"
              loadingText="Exportando…"
            >
              <FileText className="w-3.5 h-3.5 text-[#e05a1b]" />
              <span>PDF</span>
            </AsyncButton>
          </div>

          {puedeAgregar && (
            <>
              {/* Importar y Agregar */}
              <button
                disabled={limiteInvitadosAlcanzado}
                title={
                  limiteInvitadosAlcanzado
                    ? "Límite de invitaciones alcanzado"
                    : undefined
                }
                onClick={() => {
                  setArchivoError(null);
                  setNombreArchivo(null);
                  setModalImportar(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#ebd9c4] hover:bg-[#fbf8f4] text-stone-800 text-xs font-semibold rounded-xl transition-all shadow-xs disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
              >
                <Upload className="w-3.5 h-3.5 text-[#e05a1b]" />
                <span>Importar Excel / CSV</span>
              </button>

              <button
                disabled={limiteInvitadosAlcanzado}
                title={
                  limiteInvitadosAlcanzado
                    ? "Límite de invitaciones alcanzado"
                    : undefined
                }
                onClick={() => {
                  setFormNombre("");
                  setFormGrupo("");
                  setFormPases("2");
                  setFormError(null);
                  setModalAgregar(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#e05a1b] to-[#ea580c] hover:from-[#c2410c] hover:to-[#e05a1b] text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-orange-500/20 disabled:cursor-not-allowed disabled:from-stone-300 disabled:to-stone-300 disabled:shadow-none"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Agregar Invitado</span>
              </button>
            </>
          )}
        </div>
      </div>

      {permisosResueltos && soloLectura && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold">
              {vistaAdmin
                ? "Consulta administrativa"
                : "Evento finalizado · Solo lectura"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800/80">
              {vistaAdmin
                ? "Puedes consultar y exportar la información de los invitados, sin modificar sus registros."
                : "Puedes consultar y exportar la información, pero ya no es posible agregar, editar, eliminar o compartir invitaciones."}
            </p>
          </div>
        </div>
      )}

      {permisosResueltos && altasCerradas && <p role="status" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0"/>El plazo de confirmación ha cerrado. Ya no se pueden agregar ni importar invitados. Puedes seguir consultando la lista y registrando ingresos en recepción.</p>}
      {puedeModificar && limiteInvitados !== null && (
        <div
          className={`flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 ${limiteInvitadosAlcanzado ? "border-amber-200 bg-amber-50 text-amber-900" : "border-[#eadbca] bg-white text-stone-600"}`}
        >
          <div>
            <p className="text-sm font-bold">Capacidad de invitaciones</p>
            <p className="mt-1 text-xs">
              {totalInvitadosEvento} de {limiteInvitados} registros utilizados
              en este evento.
            </p>
          </div>
          {limiteInvitadosAlcanzado && (
            <span className="rounded-full bg-amber-200 px-3 py-1 text-[10px] font-bold uppercase">
              Límite alcanzado
            </span>
          )}
        </div>
      )}

      {permisosResueltos && pasesContratados !== null && (
        <div className={`flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 ${totalPasesAsignados >= pasesContratados ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          <div><p className="text-sm font-bold">Pases contratados</p><p className="mt-1 text-xs">{totalPasesAsignados} de {pasesContratados} pases comprometidos · quedan {Math.max(0, pasesContratados - totalPasesAsignados)}.</p></div>
          {totalPasesAsignados >= pasesContratados && <span className="rounded-full bg-amber-200 px-3 py-1 text-[10px] font-bold uppercase">Límite alcanzado</span>}
        </div>
      )}

      {/* Barra de Búsqueda y Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-[#ebd9c4] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o grupo..."
            className="w-full pl-10 pr-4 py-2 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
          />
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Filter className="w-4 h-4 text-stone-400 shrink-0" />
          <select
            value={filtroEstado}
            onChange={(e) => {
              setFiltroEstado(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto px-3 py-2 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-xs text-stone-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">⚪ Pendientes (sin responder)</option>
            <option value="visto">🔵 Solo Vistos</option>
            <option value="confirmado">🟢 Confirmados (todos)</option>
            <option value="parcial">🟠 Parciales (confirmaron menos)</option>
            <option value="declinado">🔴 Declinados</option>
            <option value="liberados">
              ♻️ Recuperados o disponibles para liberar
            </option>
          </select>
          {qrCheckinEnabled && (
            <select
              value={filtroEntrada}
              onChange={(e) => {
                setFiltroEntrada(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por registro de entrada"
              className="w-full sm:w-auto px-3 py-2 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-xs text-stone-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
            >
              <option value="todos">Todas las entradas</option>
              <option value="ingresaron">🟢 Ya ingresaron</option>
              <option value="sin_ingreso">⚪ Confirmados por llegar</option>
              <option value="parcial">🟠 Ingreso parcial</option>
              <option value="completo">✅ Ingreso completo</option>
            </select>
          )}
          {qrCheckinEnabled && (
            <button
              type="button"
              onClick={() => void fetchInvitados()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Actualizar entradas
            </button>
          )}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            aria-label="Invitados por página"
            className="px-3 py-2 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-xs text-stone-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
          >
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        </div>
      </div>

      {/* Tabla de Invitados (Limpia, sin tokens visibles, sin iconos amontonados) */}
      <div className="bg-white border border-[#ebd9c4] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#fbf8f4] border-b border-[#ebd9c4] text-[#86583d] font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Invitado / Familia</th>
                <th className="py-3.5 px-4 text-center">Envío</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-center">Pases</th>
                {qrCheckinEnabled && (
                  <th className="py-3.5 px-4 text-center">Entrada</th>
                )}
                <th className="py-3.5 px-4">Última Respuesta</th>
                <th className="py-3.5 px-4 text-right">Compartir</th>
                <th className="py-3.5 px-4 text-center w-12">Más</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {loading ? (
                <tr>
                  <td
                    colSpan={qrCheckinEnabled ? 8 : 7}
                    className="py-12 text-center text-stone-400 text-xs"
                  >
                    Cargando lista de invitados...
                  </td>
                </tr>
              ) : invitados.length === 0 ? (
                <tr>
                  <td
                    colSpan={qrCheckinEnabled ? 8 : 7}
                    className="py-12 text-center text-stone-400 text-xs"
                  >
                    No se encontraron invitados con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                invitados.map((inv) => {
                  const yaRespondio =
                    inv.estado === "confirmado" || inv.estado === "declinado";

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-[#fbf8f4]/60 transition-colors"
                    >
                      {/* Nombre y Grupo (Sin token que ensucie) */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-stone-900 text-sm">
                          {inv.nombre}
                        </div>
                        {inv.grupo && (
                          <div className="text-[11px] text-stone-500 font-medium mt-0.5">
                            {inv.grupo}
                          </div>
                        )}
                      </td>

                      {/* Estado de Envío (Enviado vs Sin enviar) */}
                      <td className="py-3.5 px-4 text-center">
                        {inv.enviado_en ? (
                          <span
                            title={`Enviado el ${formatDateTimeMx(inv.enviado_en)}`}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ffedd5] text-[#c2410c]"
                          >
                            <Send className="w-3 h-3" />
                            <span>Enviado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-500">
                            <span>Sin enviar</span>
                          </span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-4 text-center">
                        {renderBadgeEstado(inv)}
                      </td>

                      {/* Pases */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-stone-900">
                          {inv.pases_confirmados !== null
                            ? inv.pases_confirmados
                            : "-"}
                        </span>
                        <span className="text-stone-400">
                          {" "}
                          / {inv.pases_asignados}
                        </span>
                        {inv.pases_liberados && <span title="Estos pases ya fueron devueltos al saldo disponible del evento." className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-emerald-700"><RotateCcw aria-hidden="true" className="h-3 w-3 shrink-0"/>{inv.pases_asignados} {inv.pases_asignados === 1 ? "pase liberado" : "pases liberados"}</span>}
                        {inv.estado === "confirmado" &&
                          (inv.pases_confirmados || 0) > 0 && (
                            <div className="text-[10px] text-stone-600 font-medium mt-0.5 whitespace-nowrap">
                              {(inv.pases_confirmados || 0) -
                                (inv.ninos_confirmados || 0)}{" "}
                              ad.
                              {(inv.ninos_confirmados || 0) > 0 ? (
                                <span className="text-[#e05a1b] font-semibold">
                                  {" "}
                                  · {inv.ninos_confirmados}{" "}
                                  {inv.ninos_confirmados === 1
                                    ? "niño"
                                    : "niños"}
                                </span>
                              ) : (
                                <span className="text-stone-400">
                                  {" "}
                                  · 0 niños
                                </span>
                              )}
                            </div>
                          )}
                        {inv.estado === "confirmado" &&
                          (inv.pases_confirmados || 0) <
                            inv.pases_asignados && (
                            <span
                              title={`${recoveredPasses(inv) > 0 ? "Devueltos al saldo:" : "Reservados hasta el primer ingreso:"} ${inv.pases_asignados - (inv.pases_confirmados || 0)} ${
                                inv.pases_asignados -
                                  (inv.pases_confirmados || 0) ===
                                1
                                  ? "pase"
                                  : "pases"
                              }`}
                              className="block text-[10px] text-amber-700 font-semibold mt-0.5"
                            >
                              +
                              {inv.pases_asignados -
                                (inv.pases_confirmados || 0)}{" "}
                              {recoveredPasses(inv) > 0 ? "devueltos" : "sin confirmar · reservados"}
                            </span>
                          )}
                      </td>

                      {qrCheckinEnabled && (
                        <td className="py-3.5 px-4 text-center">
                          {inv.estado !== "confirmado" ||
                          (inv.pases_confirmados ?? 0) < 1 ? (
                            <span className="text-[11px] font-medium text-stone-400">
                              No aplica
                            </span>
                          ) : inv.pases_ingresados <= 0 ? (
                            <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600">
                              No ha llegado
                            </span>
                          ) : inv.pases_ingresados <
                            (inv.pases_confirmados ?? 0) ? (
                            <div>
                              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                                Parcial · {inv.pases_ingresados}/
                                {inv.pases_confirmados}
                              </span>
                              {inv.ultima_entrada_en && (
                                <p className="mt-1 whitespace-nowrap text-[10px] text-stone-400">
                                  {formatDateTimeMx(inv.ultima_entrada_en)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                                Completo · {inv.pases_ingresados}/
                                {inv.pases_confirmados}
                              </span>
                              {inv.ultima_entrada_en && (
                                <p className="mt-1 whitespace-nowrap text-[10px] text-stone-400">
                                  {formatDateTimeMx(inv.ultima_entrada_en)}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      )}

                      {/* Última Respuesta */}
                      <td className="py-3.5 px-4 text-stone-500">
                        {inv.ultima_respuesta_en
                          ? formatDateTimeMx(inv.ultima_respuesta_en)
                          : "-"}
                      </td>

                      {/* Acciones principales visibles: Copiar y WhatsApp (solo si pendiente/visto) */}
                      <td className="py-3.5 px-4 text-right">
                        {!puedeModificar ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                            Solo lectura
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            {/* Copiar Mensaje */}
                            <AsyncButton
                              onClick={() => handleCopiarMensaje(inv)}
                              title="Copiar mensaje personalizado con enlace"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-stone-100 text-stone-700 rounded-lg border border-stone-200 transition-colors text-xs font-medium shadow-xs"
                              loadingText="Copiando…"
                            >
                              {copiadoId === inv.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700 text-[11px]">
                                    ¡Copiado!
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-stone-500" />
                                  <span className="text-[11px]">Copiar</span>
                                </>
                              )}
                            </AsyncButton>

                            {/* WhatsApp: Visible SOLO si aún no ha confirmado o declinado */}
                            {!yaRespondio && (
                              <AsyncButton
                                onClick={() => handleAbrirWhatsApp(inv)}
                                title="Enviar por WhatsApp"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-xs transition-colors text-[11px]"
                                loadingText="Abriendo…"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </AsyncButton>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Menú desplegable ⋯ con opciones secundarias */}
                      <td className="py-3.5 px-4 text-center relative">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuAnchor(e.currentTarget);
                              setMenuAbiertoId(
                                menuAbiertoId === inv.id ? null : inv.id,
                              );
                            }}
                            className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                            type="button"
                            aria-haspopup="menu"
                            aria-expanded={menuAbiertoId === inv.id}
                            aria-controls={
                              menuAbiertoId === inv.id
                                ? `guest-actions-${inv.id}`
                                : undefined
                            }
                            aria-label={`Más opciones para ${inv.nombre}`}
                            title="Más opciones"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {menuAbiertoId === inv.id && menuAnchor && (
                            <FloatingMenu
                              anchor={menuAnchor!}
                              id={`guest-actions-${inv.id}`}
                              onClose={() => setMenuAbiertoId(null)}
                            >
                              {/* Ver como invitado */}
                              {evento && (
                                <a
                                  role="menuitem"
                                  href={`/${evento.slug}?id=${inv.token}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={() => setMenuAbiertoId(null)}
                                  className="flex items-center gap-2 px-3 py-2 text-stone-700 hover:bg-[#fbf8f4] hover:text-[#e05a1b]"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#e05a1b]" />
                                  <span>Ver como invitado</span>
                                </a>
                              )}

                              {puedeModificar && (
                                <>
                                  {releasablePasses(inv) > 0 && <AsyncButton role="menuitem" onClick={() => { setMenuAbiertoId(null); return handleLiberarPases(inv); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-emerald-800 hover:bg-emerald-50"><RotateCcw aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-emerald-700"/><span>Liberar {inv.pases_asignados} pases</span></AsyncButton>}
                                  {inv.pases_liberados && <p className="flex items-start gap-2 px-3 py-2 text-xs text-emerald-800"><RotateCcw aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700"/><span>Pases recuperados · confirmación cerrada</span></p>}
                                  {/* Editar */}
                                  <button
                                    role="menuitem"
                                    onClick={() => handleAbrirEditar(inv)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-stone-700 hover:bg-[#fbf8f4]"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-stone-500" />
                                    <span>Editar datos</span>
                                  </button>

                                  {/* Regenerar link */}
                                  <AsyncButton
                                    role="menuitem"
                                    onClick={() => {
                                      setMenuAbiertoId(null);
                                      return handleRegenerarLink(inv);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-amber-800 hover:bg-amber-50"
                                    loading={regeneratingId === inv.id}
                                    disabled={Boolean(regeneratingId) || hasAttendance(inv) || altasCerradas}
                                    loadingText="Regenerando…"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Regenerar link</span>
                                  </AsyncButton>

                                  <div className="h-[1px] bg-stone-100 my-1" />

                                  {/* Eliminar */}
                                  <button
                                    role="menuitem"
                                    disabled={inv.pases_ingresados > 0 || Boolean(inv.ultima_entrada_en)}
                                    title={inv.pases_ingresados > 0 || inv.ultima_entrada_en ? "No se puede eliminar: tiene ingresos registrados." : "Eliminar invitado e invalidar su enlace"}
                                    onClick={() => {
                                      setMenuAbiertoId(null);
                                      setModalEliminar(inv);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Eliminar</span>
                                  </button>
                                </>
                              )}
                            </FloatingMenu>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-[#ebd9c4] bg-[#fbf8f4]/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center text-[11px] text-stone-500 sm:text-left">
            {pagination.total === 0
              ? "Sin resultados"
              : `Mostrando ${(pagination.page - 1) * pagination.page_size + 1}–${Math.min(
                  pagination.page * pagination.page_size,
                  pagination.total,
                )} de ${pagination.total} invitados`}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || pagination.page <= 1}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#e1cdb8] bg-white px-3 text-xs font-semibold text-stone-700 transition-colors hover:border-[#e05a1b] hover:text-[#e05a1b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <span className="min-w-20 text-center text-[11px] font-semibold text-stone-600">
              Página {pagination.page} de {pagination.total_pages}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  Math.min(pagination.total_pages, current + 1),
                )
              }
              disabled={loading || pagination.page >= pagination.total_pages}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#e1cdb8] bg-white px-3 text-xs font-semibold text-stone-700 transition-colors hover:border-[#e05a1b] hover:text-[#e05a1b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: AGREGAR INVITADO */}
      <AnimatePresence>
        {puedeAgregar && modalAgregar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setModalAgregar(false)}
            className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          >
            <motion.div
              initial={
                reduceMotion ? false : { opacity: 0, y: 18, scale: 0.96 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl p-6 shadow-2xl border border-stone-200 relative"
            >
              <ModalHeader onClose={() => setModalAgregar(false)}>
                <h3 className="font-serif text-xl font-bold text-stone-900">
                  + Agregar Nuevo Invitado
                </h3>
              </ModalHeader>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl mb-4">
                  {formError}
                </div>
              )}

              <form onSubmit={handleGuardarNuevo} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                    Nombre del invitado o familia *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Familia Gómez Pérez"
                    {...nameInputProps}
                    value={formNombre}
                    onChange={(e) => setFormNombre(lettersOnly(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                    Grupo (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Familia Novia, Amigos Universidad"
                    value={formGrupo}
                    onChange={(e) => setFormGrupo(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">
                    Útil para identificar homónimos y organizar mesas.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                    Pases Asignados * (mínimo 1)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    value={formPases}
                    onChange={(e) => handleCambiarPases(e.target.value)}
                    aria-invalid={!formPasesValido}
                    className="w-full px-3.5 py-2.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
                  />
                  {!formPasesValido && (
                    <p className="mt-1 text-[11px] font-medium text-rose-600">
                      Ingresa al menos 1 pase.
                    </p>
                  )}

                  {/* Aviso informativo de cupo (sin bloquear) */}
                  {formPasesValido && newGuestExceedsContract && <p role="alert" className="mt-2.5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle className="h-4 w-4 shrink-0"/><span>El contrato permite <strong>{newGuestLimit} pases</strong>. Ya hay {totalPasesAsignados} comprometidos y quedan <strong>{Math.max(0, (newGuestLimit ?? 0) - totalPasesAsignados)}</strong>. No puedes guardar {formPasesNumero} pases más. Reduce la cantidad o solicita una ampliación del contrato.</span></p>}
                  {evento?.capacidad_total &&
                    !newGuestExceedsContract &&
                    formPasesValido &&
                    totalPasesAsignados + formPasesNumero >
                      evento.capacidad_total && (
                      <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Actualización de capacidad:</span>{" "}
                          Al guardar, la capacidad del evento aumentará de <strong>{evento.capacidad_total}</strong> a <strong>{totalPasesAsignados + formPasesNumero} asientos</strong> para cubrir los pases comprometidos. El límite contratado no cambia.
                        </div>
                      </div>
                    )}
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalAgregar(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <AsyncButton
                    type="submit"
                    disabled={guardando || !formPasesValido || newGuestExceedsContract}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#e05a1b] to-[#ea580c] hover:from-[#c2410c] hover:to-[#e05a1b] text-white text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
                    loadingText="Guardando…"
                    loading={guardando}
                  >
                    {guardando ? "Guardando..." : "Guardar Invitado"}
                  </AsyncButton>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: EDITAR INVITADO */}
      <AnimatePresence>
        {puedeModificar && modalEditar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setModalEditar(null)}
            className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          >
            <motion.div
              initial={
                reduceMotion ? false : { opacity: 0, y: 18, scale: 0.96 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl p-6 shadow-2xl border border-stone-200 relative"
            >
              <ModalHeader onClose={() => setModalEditar(null)}>
                <h3 className="font-serif text-xl font-bold text-stone-900">
                  Editar Invitado
                </h3>
              </ModalHeader>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl mb-4">
                  {formError}
                </div>
              )}

              <form onSubmit={handleGuardarEditar} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                    Nombre del invitado o familia
                  </label>
                  <input
                    type="text"
                    required
                    {...nameInputProps}
                    value={formNombre}
                    onChange={(e) => setFormNombre(lettersOnly(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                    Grupo (opcional)
                  </label>
                  <input
                    type="text"
                    value={formGrupo}
                    onChange={(e) => setFormGrupo(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                    Pases Asignados
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    value={formPases}
                    disabled={hasAttendance(modalEditar) || altasCerradas}
                    onChange={(e) => handleCambiarPases(e.target.value)}
                    aria-invalid={!formPasesValido}
                    className="w-full px-3.5 py-2.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
                  />
                  {!formPasesValido && (
                    <p className="mt-1 text-[11px] font-medium text-rose-600">
                      Ingresa al menos 1 pase.
                    </p>
                  )}
                  {hasAttendance(modalEditar) && <p className="mt-2 text-xs text-amber-800">{attendanceLockMessage}</p>}
                  {altasCerradas && !hasAttendance(modalEditar) && <p className="mt-2 text-xs text-amber-800">El plazo de confirmación ha cerrado. Puedes corregir el nombre y el grupo; los pases ya no pueden modificarse.</p>}
                  {modalEditar.pases_confirmados !== null && (
                    <p className="text-[11px] text-stone-500 mt-1">
                      Confirmados actualmente:{" "}
                      <strong>{modalEditar.pases_confirmados}</strong>.
                    </p>
                  )}



                  {/* Aviso informativo de cupo (sin bloquear) */}
                  {evento?.capacidad_total &&
                    formPasesValido &&
                    totalPasesAsignados -
                      (modalEditar.estado === "confirmado"
                        ? modalEditar.pases_confirmados || 0
                        : modalEditar.estado === "declinado"
                          ? 0
                          : modalEditar.pases_asignados) +
                      formPasesNumero >
                      evento.capacidad_total && (
                      <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Aviso de cupo:</span>{" "}
                          Con esta modificación superarás la capacidad
                          configurada ({evento.capacidad_total} asientos).
                        </div>
                      </div>
                    )}
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalEditar(null)}
                    className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <AsyncButton
                    type="submit"
                    disabled={guardando || !formPasesValido}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#e05a1b] to-[#ea580c] hover:from-[#c2410c] hover:to-[#e05a1b] text-white text-xs font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
                    loadingText="Guardando…"
                    loading={guardando}
                  >
                    {guardando ? "Actualizando..." : "Guardar Cambios"}
                  </AsyncButton>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: ELIMINAR INVITADO */}
      <AnimatePresence>
        {puedeModificar && modalEliminar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => {
              if (!eliminando) setModalEliminar(null);
            }}
            className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          >
            <motion.div
              initial={
                reduceMotion ? false : { opacity: 0, y: 14, scale: 0.96 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200 relative"
            >
              <h3 className="font-serif text-lg font-bold text-stone-900 mb-2">
                ¿Eliminar a {modalEliminar.nombre}?
              </h3>
              <p className="text-xs text-stone-600 mb-6 leading-relaxed">
                Esta acción no se puede deshacer. Su enlace quedará inservible y
                mostrará el mensaje{" "}
                <strong>&ldquo;Invitación no disponible&rdquo;</strong> si
                alguien intenta abrirlo. Los pases aún reservados se devolverán al saldo disponible del evento.
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setModalEliminar(null)}
                  disabled={eliminando}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Cancelar
                </button>
                <AsyncButton
                  onClick={handleConfirmarEliminar}
                  disabled={eliminando}
                  className="inline-flex min-w-28 items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:cursor-not-allowed disabled:bg-rose-400"
                  loadingText="Eliminando…"
                >
                  {eliminando ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Eliminando…
                    </>
                  ) : (
                    "Sí, eliminar"
                  )}
                </AsyncButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: IMPORTACIÓN MASIVA CSV/EXCEL */}
      <AnimatePresence>
        {puedeAgregar && modalImportar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => {
              setModalImportar(false);
              setFilasImportadas([]);
              setResumenImportacion(null);
              setNombreArchivo(null);
              setArchivoError(null);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => e.preventDefault()}
            className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          >
            <motion.div
              initial={
                reduceMotion ? false : { opacity: 0, y: 20, scale: 0.97 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-2xl rounded-3xl p-6 shadow-2xl border border-stone-200 relative max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                <div>
                  <h3 className="font-serif text-xl font-bold text-stone-900">
                    Importar Invitados desde Archivo
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Admite archivos .xlsx (Excel) o .csv con columnas:{" "}
                    <code>nombre</code>, <code>pases</code>, <code>grupo</code>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setModalImportar(false);
                    setFilasImportadas([]);
                    setResumenImportacion(null);
                    setNombreArchivo(null);
                    setArchivoError(null);
                  }}
                  className="text-stone-400 hover:text-stone-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Zona de subida */}
              {!resumenImportacion ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(true);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) procesarArchivo(file);
                  }}
                  className={`py-8 px-6 text-center flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition-all duration-200 ${
                    isDragging
                      ? "border-[#e05a1b] bg-[#fff7ed] scale-[1.01]"
                      : "border-stone-200 bg-[#fbf8f4]/50 hover:bg-[#fbf8f4] hover:border-stone-300"
                  }`}
                >
                  <input
                    id="subir-archivo-input"
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    onChange={handleArchivoSeleccionado}
                    className="sr-only"
                  />

                  <label
                    htmlFor="subir-archivo-input"
                    className="cursor-pointer flex flex-col items-center w-full"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white border border-[#ebd9c4] flex items-center justify-center text-[#e05a1b] mb-4 shadow-xs">
                      <FileUp className="w-8 h-8 text-[#e05a1b]" />
                    </div>

                    <h4 className="font-semibold text-stone-900 text-sm mb-1">
                      {isDragging
                        ? "¡Suelta tu archivo aquí!"
                        : "Arrastra tu archivo aquí o haz clic para seleccionarlo"}
                    </h4>

                    <p className="text-xs text-stone-500 max-w-sm mb-4">
                      Admite <strong>.xlsx (Excel)</strong> o{" "}
                      <strong>.csv</strong>. Columnas reconocidas:{" "}
                      <code>nombre</code>, <code>pases</code> y opcionalmente{" "}
                      <code>grupo</code>.
                    </p>

                    <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#e05a1b] to-[#ea580c] text-white text-xs font-semibold rounded-xl shadow-sm transition-all pointer-events-none">
                      <Upload className="w-4 h-4 text-white" />
                      <span>Seleccionar archivo Excel o CSV</span>
                    </span>
                  </label>

                  {archivoError && (
                    <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 text-left">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{archivoError}</span>
                    </div>
                  )}

                  {/* Descargar plantillas de ayuda */}
                  <div className="mt-6 pt-5 border-t border-stone-200/60 w-full flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-stone-500">
                    <span className="font-medium">
                      ¿Quieres una plantilla prediseñada?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDescargarPlantilla("xlsx")}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#fbf8f4] text-stone-700 border border-stone-200 rounded-lg font-medium text-[11px] transition-colors shadow-xs"
                      >
                        <Download className="w-3 h-3 text-[#e05a1b]" />
                        <span>Descargar Plantilla Excel (.xlsx)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDescargarPlantilla("csv")}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#fbf8f4] text-stone-700 border border-stone-200 rounded-lg font-medium text-[11px] transition-colors shadow-xs"
                      >
                        <Download className="w-3 h-3 text-stone-500" />
                        <span>Descargar Plantilla CSV (.csv)</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 flex-1 overflow-y-auto space-y-4">
                  {/* Archivo cargado */}
                  {nombreArchivo && (
                    <div className="flex items-center justify-between bg-[#fbf8f4] px-3.5 py-2 rounded-xl border border-[#ebd9c4] text-xs">
                      <span className="text-stone-600">
                        Archivo:{" "}
                        <strong className="text-stone-900">
                          {nombreArchivo}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setResumenImportacion(null);
                          setFilasImportadas([]);
                          setNombreArchivo(null);
                        }}
                        className="text-[#e05a1b] hover:underline font-semibold text-[11px]"
                      >
                        Cambiar archivo
                      </button>
                    </div>
                  )}

                  {/* Resumen de validación */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#fbf8f4] p-3 rounded-xl border border-stone-200 text-center">
                      <span className="text-[11px] text-stone-500 font-semibold uppercase">
                        Total Filas
                      </span>
                      <p className="text-lg font-serif font-bold text-stone-800">
                        {resumenImportacion.total}
                      </p>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                      <span className="text-[11px] text-emerald-700 font-semibold uppercase">
                        Válidos
                      </span>
                      <p className="text-lg font-serif font-bold text-emerald-800">
                        {resumenImportacion.validos}
                      </p>
                    </div>
                    <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-center">
                      <span className="text-[11px] text-rose-700 font-semibold uppercase">
                        Con Errores
                      </span>
                      <p className="text-lg font-serif font-bold text-rose-800">
                        {resumenImportacion.invalidos}
                      </p>
                    </div>
                  </div>

                  {/* Previsualización de filas */}
                  <div className="border border-stone-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#fbf8f4] border-b border-stone-200 text-stone-500 font-semibold">
                        <tr>
                          <th className="py-2 px-3">Estado</th>
                          <th className="py-2 px-3">Nombre</th>
                          <th className="py-2 px-3">Pases</th>
                          <th className="py-2 px-3">Grupo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {filasImportadas.map((fila, idx) => (
                          <tr
                            key={idx}
                            className={
                              fila.valido
                                ? "bg-white"
                                : "bg-rose-50/50 text-rose-800"
                            }
                          >
                            <td className="py-2 px-3">
                              {fila.valido ? (
                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <span
                                  className="text-[11px] font-semibold text-rose-600 flex items-center gap-1"
                                  title={fila.error}
                                >
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  {fila.error}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-medium">
                              {fila.nombre || "(Vacío)"}
                            </td>
                            <td className="py-2 px-3">
                              {fila.pases_asignados}
                            </td>
                            <td className="py-2 px-3 text-stone-500">
                              {fila.grupo || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {resumenImportacion && (
                <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setResumenImportacion(null);
                      setFilasImportadas([]);
                      setNombreArchivo(null);
                    }}
                    className="text-xs text-stone-500 hover:text-stone-800"
                  >
                    ← Subir otro archivo
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setModalImportar(false);
                        setFilasImportadas([]);
                        setResumenImportacion(null);
                        setNombreArchivo(null);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900"
                    >
                      Cancelar
                    </button>
                    <AsyncButton
                      disabled={
                        resumenImportacion.validos === 0 ||
                        importando ||
                        (limiteInvitados !== null &&
                          totalInvitadosEvento + resumenImportacion.validos >
                            limiteInvitados) ||
                        (limitePases !== null && totalPasesAsignados + filasImportadas.filter((fila) => fila.valido).reduce((total, fila) => total + fila.pases_asignados, 0) > limitePases)
                      }
                      onClick={handleGuardarImportacion}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#e05a1b] to-[#ea580c] hover:from-[#c2410c] hover:to-[#e05a1b] text-white text-xs font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50"
                      loadingText="Importando…"
                    >
                      {importando
                        ? "Importando..."
                        : `Guardar ${resumenImportacion.validos} Invitados`}
                    </AsyncButton>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function InvitadosPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-stone-400 text-xs">
          Cargando lista de invitados...
        </div>
      }
    >
      <InvitadosContent />
    </Suspense>
  );
}
