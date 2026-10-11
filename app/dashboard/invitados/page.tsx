"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Filter,
  UserPlus,
  FileSpreadsheet,
  Copy,
  Check,
  RefreshCw,
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
} from "lucide-react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateTimeMx, formatDateMx, formatDateLongMx } from "@/lib/utils";

interface Invitado {
  id: string;
  nombre: string;
  grupo: string | null;
  pases_asignados: number;
  pases_confirmados: number | null;
  estado: "pendiente" | "visto" | "confirmado" | "declinado";
  token: string;
  enviado_en: string | null;
  ultima_respuesta_en: string | null;
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
  plantilla_mensaje: string;
  plantilla_recordatorio: string;
}

function InvitadosContent() {
  const searchParams = useSearchParams();
  const estadoParam = searchParams.get("estado");

  const [evento, setEvento] = useState<Evento | null>(null);
  const [invitados, setInvitados] = useState<Invitado[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros (conectados con la URL al hacer clic desde el dashboard)
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState(estadoParam || "todos");

  useEffect(() => {
    const estado = searchParams.get("estado");
    if (estado) {
      setFiltroEstado(estado);
    }
  }, [searchParams]);

  // Modales
  const [modalAgregar, setModalAgregar] = useState(false);
  const [modalEditar, setModalEditar] = useState<Invitado | null>(null);
  const [modalImportar, setModalImportar] = useState(false);
  const [modalEliminar, setModalEliminar] = useState<Invitado | null>(null);

  // Menú de opciones abierto por fila (id de invitado)
  const [menuAbiertoId, setMenuAbiertoId] = useState<string | null>(null);

  // Formulario Agregar / Editar
  const [formNombre, setFormNombre] = useState("");
  const [formGrupo, setFormGrupo] = useState("");
  const [formPases, setFormPases] = useState(2);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Importación masiva
  const [filasImportadas, setFilasImportadas] = useState<
    Array<{ nombre: string; pases_asignados: number; grupo: string; valido: boolean; error?: string }>
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
  const fetchInvitados = async () => {
    try {
      const res = await fetch("/api/invitados");
      const data = await res.json();
      if (res.ok) {
        setEvento(data.evento);
        setInvitados(data.invitados || []);
      }
    } catch (e) {
      console.error("Error al cargar invitados", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitados();
  }, []);

  // Filtrado instantáneo en memoria (0ms, 60fps) sin peticiones innecesarias
  const invitadosFiltrados = useMemo(() => {
    const term = search.toLowerCase().trim();
    return invitados.filter((inv) => {
      const matchSearch =
        !term ||
        inv.nombre.toLowerCase().includes(term) ||
        (inv.grupo && inv.grupo.toLowerCase().includes(term));

      let matchEstado = true;
      if (filtroEstado === "todos") {
        matchEstado = true;
      } else if (filtroEstado === "pendiente") {
        // Muestra todos los que aún no responden (pendientes o vistos)
        matchEstado = inv.estado === "pendiente" || inv.estado === "visto";
      } else if (filtroEstado === "visto") {
        matchEstado = inv.estado === "visto";
      } else if (filtroEstado === "confirmado") {
        // Todos los confirmados (incluye parciales)
        matchEstado = inv.estado === "confirmado";
      } else if (filtroEstado === "parcial") {
        // Solo los que confirmaron menos de los asignados
        matchEstado =
          inv.estado === "confirmado" &&
          (inv.pases_confirmados || 0) > 0 &&
          (inv.pases_confirmados || 0) < inv.pases_asignados;
      } else if (filtroEstado === "declinado") {
        matchEstado = inv.estado === "declinado";
      } else if (filtroEstado === "liberados") {
        // Declinados o que confirmaron menos pases de los asignados
        matchEstado =
          inv.estado === "declinado" ||
          (inv.estado === "confirmado" &&
            (inv.pases_confirmados || 0) < inv.pases_asignados);
      } else {
        matchEstado = inv.estado === filtroEstado;
      }

      return matchSearch && matchEstado;
    });
  }, [invitados, search, filtroEstado]);

  // Total de pases comprometidos (confirmados + pendientes; declinados liberan lugar)
  const totalPasesAsignados = useMemo(() => {
    return invitados.reduce((sum, inv) => {
      if (inv.estado === "confirmado") {
        return sum + (inv.pases_confirmados || 0);
      } else if (inv.estado === "declinado") {
        return sum; // Declinado no ocupa cupo
      } else {
        return sum + inv.pases_asignados;
      }
    }, 0);
  }, [invitados]);

  // Cerrar modales con tecla Escape y cerrar menú de opciones al hacer clic afuera
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalAgregar(false);
        setModalEditar(null);
        setModalImportar(false);
        setModalEliminar(null);
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
  }, []);

  // Generar link completo
  const getInvitationUrl = (token: string) => {
    if (typeof window === "undefined" || !evento) return "";
    return `${window.location.origin}/${evento.slug}?id=${token}`;
  };

  // Construir mensaje para WhatsApp o Copiar con variables neutras
  const getArmadoMensaje = (invitado: Invitado) => {
    if (!evento) return "";
    const esRecordatorio = invitado.estado === "pendiente" || invitado.estado === "visto";
    const plantilla = esRecordatorio ? evento.plantilla_recordatorio : evento.plantilla_mensaje;
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
            i.id === invitadoId ? { ...i, enviado_en: data.enviado_en } : i
          )
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

  // Regenerar link
  const handleRegenerarLink = async (invitado: Invitado) => {
    if (
      !confirm(
        `¿Seguro que deseas regenerar el link para ${invitado.nombre}? El link anterior dejará de funcionar de inmediato.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/invitados/${invitado.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerar_link" }),
      });
      if (res.ok) {
        await fetchInvitados();
        alert("Enlace regenerado con éxito. Recuerda compartir el nuevo enlace.");
      }
    } catch (e) {
      console.error("Error al regenerar link", e);
    }
  };

  // Guardar nuevo invitado
  const handleGuardarNuevo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evento) return;
    setGuardando(true);
    setFormError(null);

    try {
      const res = await fetch("/api/invitados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento_id: evento.id,
          nombre: formNombre,
          grupo: formGrupo,
          pases_asignados: formPases,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al agregar invitado.");

      setModalAgregar(false);
      setFormNombre("");
      setFormGrupo("");
      setFormPases(2);
      await fetchInvitados();
    } catch (err: unknown) {
      if (err instanceof Error) setFormError(err.message);
      else setFormError("Error inesperado al guardar.");
    } finally {
      setGuardando(false);
    }
  };

  // Abrir modal editar
  const handleAbrirEditar = (inv: Invitado) => {
    setModalEditar(inv);
    setFormNombre(inv.nombre);
    setFormGrupo(inv.grupo || "");
    setFormPases(inv.pases_asignados);
    setFormError(null);
    setMenuAbiertoId(null);
  };

  // Guardar edición
  const handleGuardarEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditar) return;
    setGuardando(true);
    setFormError(null);

    if (
      modalEditar.pases_confirmados !== null &&
      formPases < modalEditar.pases_confirmados
    ) {
      const confirmar = confirm(
        `Atención: El invitado ya tiene ${modalEditar.pases_confirmados} pases confirmados. Al reducir los pases a ${formPases}, su confirmación se ajustará automáticamente a ${formPases}. ¿Deseas continuar?`
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
          pases_asignados: formPases,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar invitado.");

      setModalEditar(null);
      await fetchInvitados();
    } catch (err: unknown) {
      if (err instanceof Error) setFormError(err.message);
      else setFormError("Error inesperado al guardar.");
    } finally {
      setGuardando(false);
    }
  };

  // Eliminar invitado
  const handleConfirmarEliminar = async () => {
    if (!modalEliminar) return;
    try {
      const res = await fetch(`/api/invitados/${modalEliminar.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setModalEliminar(null);
        await fetchInvitados();
      }
    } catch (e) {
      console.error("Error al eliminar", e);
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
          `Formato ".${extension}" no compatible. Por favor sube un archivo Excel (.xlsx, .xls) o CSV (.csv).`
        );
      }
    } catch (err: unknown) {
      console.error("Error al procesar archivo:", err);
      setArchivoError(
        "No se pudo leer el archivo. Asegúrate de que no esté abierto en otro programa ni protegido con contraseña."
      );
    }
  };

  const handleArchivoSeleccionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) procesarArchivo(file);
    e.target.value = "";
  };

  const procesarFilasImportadas = (data: Record<string, unknown>[]) => {
    if (!data || data.length === 0) {
      setArchivoError("El archivo parece estar vacío o no contiene filas con datos.");
      return;
    }

    const procesadas = data.map((fila) => {
      const keys = Object.keys(fila);
      const nombreKey = keys.find((k) =>
        /^(nombre|invitado|familia|name)/i.test(k.trim())
      );
      const pasesKey = keys.find((k) =>
        /^(pases|pases_asignados|boletos|lugares|personas|tickets)/i.test(k.trim())
      );
      const grupoKey = keys.find((k) =>
        /^(grupo|categoria|categoría|familia de|mesa|group)/i.test(k.trim())
      );

      const nombre = String((nombreKey ? fila[nombreKey] : "") || "").trim();
      const pasesRaw = pasesKey ? fila[pasesKey] : "1";
      const grupo = String((grupoKey ? fila[grupoKey] : "") || "").trim();

      const pasesNum = parseInt(String(pasesRaw ?? "1"), 10);
      const valido = Boolean(nombre.length > 0 && !isNaN(pasesNum) && pasesNum >= 1);

      let error = undefined;
      if (!nombre) error = "Nombre vacío";
      else if (isNaN(pasesNum) || pasesNum < 1) error = "Pases inválidos (mínimo 1)";

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
      { nombre: "Carlos Mendoza y Acompañante", pases: 2, grupo: "Amigos de Luis" },
      { nombre: "Dra. Sofía Alarcón", pases: 1, grupo: "Colegas" },
      { nombre: "Familia Treviño Morales", pases: 3, grupo: "Familia del Novio" },
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
    if (!evento || !resumenImportacion || resumenImportacion.validos === 0) return;
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

      if (res.ok) {
        setModalImportar(false);
        setFilasImportadas([]);
        setResumenImportacion(null);
        await fetchInvitados();
        alert(`¡Se importaron ${validas.length} invitados correctamente!`);
      }
    } catch (e) {
      console.error("Error al importar", e);
    } finally {
      setImportando(false);
    }
  };

  // EXPORTAR: Lista de confirmados a Excel (.xlsx)
  const handleExportarExcelConfirmados = () => {
    if (!evento) return;
    const confirmados = invitados.filter((i) => i.estado === "confirmado");
    if (confirmados.length === 0) {
      alert("Aún no tienes invitados confirmados para exportar.");
      return;
    }

    const totalPlatillos = confirmados.reduce(
      (sum, i) => sum + (i.pases_confirmados || 0),
      0
    );

    const filas = confirmados.map((inv, index) => ({
      "#": index + 1,
      "Invitado / Familia": inv.nombre,
      "Grupo": inv.grupo || "General",
      "Platillos Confirmados": inv.pases_confirmados || 0,
      "Fecha de Confirmación": formatDateTimeMx(inv.ultima_respuesta_en),
    }));

    filas.push({
      "#": "" as unknown as number,
      "Invitado / Familia": "TOTAL PLATILLOS A PREPARAR",
      "Grupo": "",
      "Platillos Confirmados": totalPlatillos,
      "Fecha de Confirmación": "",
    });

    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Confirmados");
    XLSX.writeFile(
      wb,
      `Lista_Confirmados_${evento.nombre.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`
    );
  };

  // EXPORTAR: Lista de confirmados a PDF
  const handleExportarPDFConfirmados = () => {
    if (!evento) return;
    const confirmados = invitados.filter((i) => i.estado === "confirmado");
    if (confirmados.length === 0) {
      alert("Aún no tienes invitados confirmados para exportar.");
      return;
    }

    const totalPlatillos = confirmados.reduce(
      (sum, i) => sum + (i.pases_confirmados || 0),
      0
    );

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Encabezado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(43, 33, 27);
    doc.text("MONARQUE • LISTA DE CONFIRMADOS", 14, 20);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`Lista oficial para salón y banquete`, 14, 26);

    doc.setDrawColor(224, 90, 27);
    doc.line(14, 30, 196, 30);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(43, 33, 27);
    doc.text(`Evento: ${evento.nombre}`, 14, 37);
    doc.text(`Anfitriones: ${evento.anfitriones}`, 14, 43);
    doc.text(`Fecha: ${formatDateLongMx(evento.fecha_evento)}`, 14, 49);
    doc.text(`Lugar: ${evento.lugar}`, 14, 55);

    // Caja de Platillos
    doc.setFillColor(251, 248, 244);
    doc.roundedRect(125, 34, 71, 25, 3, 3, "F");
    doc.setFontSize(9);
    doc.setTextColor(224, 90, 27);
    doc.text("TOTAL PLATILLOS A PAGAR", 130, 41);
    doc.setFontSize(17);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(43, 33, 27);
    doc.text(`${totalPlatillos} Platillos`, 130, 52);

    const bodyData = confirmados.map((inv, idx) => [
      idx + 1,
      inv.nombre,
      inv.grupo || "-",
      `${inv.pases_confirmados || 0} pases`,
      formatDateTimeMx(inv.ultima_respuesta_en),
    ]);

    autoTable(doc, {
      startY: 64,
      head: [["#", "Invitado / Familia", "Grupo", "Platillos Conf.", "Fecha Confirmación"]],
      body: bodyData,
      theme: "striped",
      headStyles: {
        fillColor: [43, 33, 27],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      styles: { fontSize: 8.5, cellPadding: 3 },
      foot: [["", "TOTAL GENERAL", "", `${totalPlatillos} platillos`, ""]],
      footStyles: {
        fillColor: [245, 237, 226],
        textColor: [43, 33, 27],
        fontStyle: "bold",
        fontSize: 9,
      },
    });

    doc.save(
      `Lista_Confirmados_${evento.nombre.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`
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

  const totalConfirmados = invitados.filter((i) => i.estado === "confirmado").length;

  return (
    <div className="space-y-6">
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
            <button
              onClick={handleExportarExcelConfirmados}
              title="Descargar lista de confirmados en Excel"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-emerald-50 text-stone-800 hover:text-emerald-700 text-xs font-semibold rounded-lg border border-stone-200 transition-colors shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              onClick={handleExportarPDFConfirmados}
              title="Descargar lista de confirmados en PDF"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-[#ffedd5] text-stone-800 hover:text-[#c2410c] text-xs font-semibold rounded-lg border border-stone-200 transition-colors shadow-xs ml-1"
            >
              <FileText className="w-3.5 h-3.5 text-[#e05a1b]" />
              <span>PDF</span>
            </button>
          </div>

          {/* Importar y Agregar */}
          <button
            onClick={() => {
              setArchivoError(null);
              setNombreArchivo(null);
              setModalImportar(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#ebd9c4] hover:bg-[#fbf8f4] text-stone-800 text-xs font-semibold rounded-xl transition-all shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-[#e05a1b]" />
            <span>Importar Excel / CSV</span>
          </button>

          <button
            onClick={() => {
              setFormNombre("");
              setFormGrupo("");
              setFormPases(2);
              setFormError(null);
              setModalAgregar(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#e05a1b] to-[#ea580c] hover:from-[#c2410c] hover:to-[#e05a1b] text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-orange-500/20"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Agregar Invitado</span>
          </button>
        </div>
      </div>

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

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-stone-400 shrink-0" />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-xs text-stone-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">⚪ Pendientes (sin responder)</option>
            <option value="visto">🔵 Solo Vistos</option>
            <option value="confirmado">🟢 Confirmados (todos)</option>
            <option value="parcial">🟠 Parciales (confirmaron menos)</option>
            <option value="declinado">🔴 Declinados</option>
            <option value="liberados">♻️ Pases liberados (declinados + parciales)</option>
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
                <th className="py-3.5 px-4">Última Respuesta</th>
                <th className="py-3.5 px-4 text-right">Compartir</th>
                <th className="py-3.5 px-4 text-center w-12">Más</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400 text-xs">
                    Cargando lista de invitados...
                  </td>
                </tr>
              ) : invitadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400 text-xs">
                    No se encontraron invitados con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                invitadosFiltrados.map((inv) => {
                  const yaRespondio = inv.estado === "confirmado" || inv.estado === "declinado";

                  return (
                    <tr key={inv.id} className="hover:bg-[#fbf8f4]/60 transition-colors">
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
                          {inv.pases_confirmados !== null ? inv.pases_confirmados : "-"}
                        </span>
                        <span className="text-stone-400"> / {inv.pases_asignados}</span>
                        {inv.estado === "confirmado" &&
                          (inv.pases_confirmados || 0) < inv.pases_asignados && (
                            <span
                              title={`Liberó ${inv.pases_asignados - (inv.pases_confirmados || 0)} ${
                                inv.pases_asignados - (inv.pases_confirmados || 0) === 1
                                  ? "pase"
                                  : "pases"
                              }`}
                              className="block text-[10px] text-amber-700 font-semibold mt-0.5"
                            >
                              +{inv.pases_asignados - (inv.pases_confirmados || 0)} libre
                            </span>
                          )}
                      </td>

                      {/* Última Respuesta */}
                      <td className="py-3.5 px-4 text-stone-500">
                        {inv.ultima_respuesta_en
                          ? formatDateTimeMx(inv.ultima_respuesta_en)
                          : "-"}
                      </td>

                      {/* Acciones principales visibles: Copiar y WhatsApp (solo si pendiente/visto) */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Copiar Mensaje */}
                          <button
                            onClick={() => handleCopiarMensaje(inv)}
                            title="Copiar mensaje personalizado con enlace"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-stone-100 text-stone-700 rounded-lg border border-stone-200 transition-colors text-xs font-medium shadow-xs"
                          >
                            {copiadoId === inv.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-700 text-[11px]">¡Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-stone-500" />
                                <span className="text-[11px]">Copiar</span>
                              </>
                            )}
                          </button>

                          {/* WhatsApp: Visible SOLO si aún no ha confirmado o declinado */}
                          {!yaRespondio && (
                            <button
                              onClick={() => handleAbrirWhatsApp(inv)}
                              title="Enviar por WhatsApp"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-xs transition-colors text-[11px]"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Menú desplegable ⋯ con opciones secundarias */}
                      <td className="py-3.5 px-4 text-center relative">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuAbiertoId(menuAbiertoId === inv.id ? null : inv.id);
                            }}
                            className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                            title="Más opciones"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {menuAbiertoId === inv.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#ebd9c4] rounded-xl shadow-xl z-30 py-1.5 text-left text-xs animate-in fade-in"
                            >
                              {/* Ver como invitado */}
                              {evento && (
                                <a
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

                              {/* Editar */}
                              <button
                                onClick={() => handleAbrirEditar(inv)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-stone-700 hover:bg-[#fbf8f4]"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-stone-500" />
                                <span>Editar datos</span>
                              </button>

                              {/* Regenerar link */}
                              <button
                                onClick={() => {
                                  setMenuAbiertoId(null);
                                  handleRegenerarLink(inv);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-amber-800 hover:bg-amber-50"
                              >
                                <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                                <span>Regenerar link</span>
                              </button>

                              <div className="h-[1px] bg-stone-100 my-1" />

                              {/* Eliminar */}
                              <button
                                onClick={() => {
                                  setMenuAbiertoId(null);
                                  setModalEliminar(inv);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-rose-700 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>Eliminar</span>
                              </button>
                            </div>
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
      </div>

      {/* MODAL: AGREGAR INVITADO */}
      {modalAgregar && (
        <div
          onClick={() => setModalAgregar(false)}
          className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-stone-200 relative animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl font-bold text-stone-900">
                + Agregar Nuevo Invitado
              </h3>
              <button
                onClick={() => setModalAgregar(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

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
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
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
                  type="number"
                  min="1"
                  required
                  value={formPases}
                  onChange={(e) => setFormPases(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3.5 py-2.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
                />

                {/* Aviso informativo de cupo (sin bloquear) */}
                {evento?.capacidad_total &&
                  totalPasesAsignados + formPases > evento.capacidad_total && (
                    <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Aviso de cupo:</span> Con este invitado superarás la capacidad del evento ({evento.capacidad_total} asientos) por{" "}
                        <strong>
                          {totalPasesAsignados + formPases - evento.capacidad_total}{" "}
                          {totalPasesAsignados + formPases - evento.capacidad_total === 1
                            ? "cupo"
                            : "cupos"}
                        </strong>
                        . Puedes guardar si planeas sobreinvitar.
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
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#e05a1b] to-[#ea580c] hover:from-[#c2410c] hover:to-[#e05a1b] text-white text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : "Guardar Invitado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR INVITADO */}
      {modalEditar && (
        <div
          onClick={() => setModalEditar(null)}
          className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-stone-200 relative animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl font-bold text-stone-900">
                Editar Invitado
              </h3>
              <button
                onClick={() => setModalEditar(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

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
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
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
                  type="number"
                  min="1"
                  required
                  value={formPases}
                  onChange={(e) => setFormPases(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3.5 py-2.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
                />
                {modalEditar.pases_confirmados !== null && (
                  <p className="text-[11px] text-stone-500 mt-1">
                    Confirmados actualmente: <strong>{modalEditar.pases_confirmados}</strong>.
                  </p>
                )}

                {/* Aviso informativo de cupo (sin bloquear) */}
                {evento?.capacidad_total &&
                  totalPasesAsignados -
                    (modalEditar.estado === "confirmado"
                      ? modalEditar.pases_confirmados || 0
                      : modalEditar.estado === "declinado"
                      ? 0
                      : modalEditar.pases_asignados) +
                    formPases >
                    evento.capacidad_total && (
                    <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Aviso de cupo:</span> Con esta modificación superarás la capacidad configurada ({evento.capacidad_total} asientos).
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
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#e05a1b] to-[#ea580c] hover:from-[#c2410c] hover:to-[#e05a1b] text-white text-xs font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {guardando ? "Actualizando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ELIMINAR INVITADO */}
      {modalEliminar && (
        <div
          onClick={() => setModalEliminar(null)}
          className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200 relative animate-in fade-in duration-200"
          >
            <h3 className="font-serif text-lg font-bold text-stone-900 mb-2">
              ¿Eliminar a {modalEliminar.nombre}?
            </h3>
            <p className="text-xs text-stone-600 mb-6 leading-relaxed">
              Esta acción no se puede deshacer. Su enlace quedará inservible y mostrará el mensaje{" "}
              <strong>&ldquo;Invitación no disponible&rdquo;</strong> si alguien intenta abrirlo.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setModalEliminar(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarEliminar}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IMPORTACIÓN MASIVA CSV/EXCEL */}
      {modalImportar && (
        <div
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
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-2xl rounded-3xl p-6 shadow-2xl border border-stone-200 relative max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div>
                <h3 className="font-serif text-xl font-bold text-stone-900">
                  Importar Invitados desde Archivo
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Admite archivos .xlsx (Excel) o .csv con columnas: <code>nombre</code>,{" "}
                  <code>pases</code>, <code>grupo</code>
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
                    Admite <strong>.xlsx (Excel)</strong> o <strong>.csv</strong>. Columnas reconocidas: <code>nombre</code>, <code>pases</code> y opcionalmente <code>grupo</code>.
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
                  <span className="font-medium">¿Quieres una plantilla prediseñada?</span>
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
                      Archivo: <strong className="text-stone-900">{nombreArchivo}</strong>
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
                    <span className="text-[11px] text-stone-500 font-semibold uppercase">Total Filas</span>
                    <p className="text-lg font-serif font-bold text-stone-800">
                      {resumenImportacion.total}
                    </p>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                    <span className="text-[11px] text-emerald-700 font-semibold uppercase">Válidos</span>
                    <p className="text-lg font-serif font-bold text-emerald-800">
                      {resumenImportacion.validos}
                    </p>
                  </div>
                  <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-center">
                    <span className="text-[11px] text-rose-700 font-semibold uppercase">Con Errores</span>
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
                          className={fila.valido ? "bg-white" : "bg-rose-50/50 text-rose-800"}
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
                          <td className="py-2 px-3 font-medium">{fila.nombre || "(Vacío)"}</td>
                          <td className="py-2 px-3">{fila.pases_asignados}</td>
                          <td className="py-2 px-3 text-stone-500">{fila.grupo || "-"}</td>
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
                  <button
                    disabled={resumenImportacion.validos === 0 || importando}
                    onClick={handleGuardarImportacion}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#e05a1b] to-[#ea580c] hover:from-[#c2410c] hover:to-[#e05a1b] text-white text-xs font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50"
                  >
                    {importando
                      ? "Importando..."
                      : `Guardar ${resumenImportacion.validos} Invitados`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
