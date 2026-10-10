"use client";

import { useState, useEffect, useRef } from "react";
import {
  Users,
  Search,
  Filter,
  UserPlus,
  FileSpreadsheet,
  Copy,
  Check,
  RefreshCw,
  Edit2,
  Trash2,
  Share2,
  X,
  Upload,
  AlertCircle,
  CheckCircle,
  MessageCircle,
  Download,
  FileUp,
} from "lucide-react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { formatDateTimeMx } from "@/lib/utils";

interface Invitado {
  id: string;
  nombre: string;
  grupo: string | null;
  pases_asignados: number;
  pases_confirmados: number | null;
  estado: "pendiente" | "visto" | "confirmado" | "declinado";
  token: string;
  ultima_respuesta_en: string | null;
  creado_en: string;
}

interface Evento {
  id: string;
  slug: string;
  nombre: string;
  plantilla_mensaje: string;
  plantilla_recordatorio: string;
}

interface KPIs {
  total_asignados: number;
  total_confirmados: number;
  total_declinados: number;
  total_pendientes: number;
  pases_liberados: number;
  total_invitados: number;
}

export default function InvitadosPage() {
  const [evento, setEvento] = useState<Evento | null>(null);
  const [invitados, setInvitados] = useState<Invitado[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  // Modales
  const [modalAgregar, setModalAgregar] = useState(false);
  const [modalEditar, setModalEditar] = useState<Invitado | null>(null);
  const [modalImportar, setModalImportar] = useState(false);
  const [modalEliminar, setModalEliminar] = useState<Invitado | null>(null);

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
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filtroEstado !== "todos") params.append("estado", filtroEstado);

      const res = await fetch(`/api/invitados?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setEvento(data.evento);
        setInvitados(data.invitados || []);
        setKpis(data.kpis);
      }
    } catch (e) {
      console.error("Error al cargar invitados", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitados();
  }, [search, filtroEstado]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalAgregar(false);
        setModalEditar(null);
        setModalImportar(false);
        setModalEliminar(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Generar link completo
  const getInvitationUrl = (token: string) => {
    if (typeof window === "undefined" || !evento) return "";
    return `${window.location.origin}/${evento.slug}?id=${token}`;
  };

  // Construir mensaje para WhatsApp o Copiar (RF-16, RF-17, RF-18)
  const getArmadoMensaje = (invitado: Invitado) => {
    if (!evento) return "";
    const esRecordatorio = invitado.estado === "pendiente" || invitado.estado === "visto";
    const plantilla = esRecordatorio ? evento.plantilla_recordatorio : evento.plantilla_mensaje;
    const link = getInvitationUrl(invitado.token);

    return plantilla
      .replace(/{nombre}/g, invitado.nombre)
      .replace(/{pases}/g, String(invitado.pases_asignados))
      .replace(/{link}/g, link);
  };

  // Copiar mensaje (RF-16)
  const handleCopiarMensaje = async (invitado: Invitado) => {
    const texto = getArmadoMensaje(invitado);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoId(invitado.id);
      setTimeout(() => setCopiadoId(null), 2500);
    } catch (e) {
      console.error("Error al copiar texto", e);
    }
  };

  // Abrir WhatsApp (RF-17)
  const handleAbrirWhatsApp = (invitado: Invitado) => {
    const texto = getArmadoMensaje(invitado);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };

  // Regenerar link (RF-13)
  const handleRegenerarLink = async (invitado: Invitado) => {
    if (
      !confirm(
        `¿Seguro que deseas regenerar el link para ${invitado.nombre}? El link que ya tenga enviado dejará de funcionar inmediatamente.`
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

  // Guardar invitado nuevo (RF-08)
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

  // Abrir modal editar (RF-09, RN-02)
  const handleAbrirEditar = (inv: Invitado) => {
    setModalEditar(inv);
    setFormNombre(inv.nombre);
    setFormGrupo(inv.grupo || "");
    setFormPases(inv.pases_asignados);
    setFormError(null);
  };

  // Guardar edición
  const handleGuardarEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditar) return;
    setGuardando(true);
    setFormError(null);

    // Advertencia RN-02
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

  // Eliminar invitado (RF-09, RF-15)
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

  // Procesar archivo Excel o CSV (RF-10)
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
    if (file) {
      procesarArchivo(file);
    }
    // Reiniciar para permitir seleccionar el mismo archivo si se desea reintentar
    e.target.value = "";
  };

  const procesarFilasImportadas = (data: Record<string, unknown>[]) => {
    if (!data || data.length === 0) {
      setArchivoError("El archivo parece estar vacío o no contiene filas con datos.");
      return;
    }

    const procesadas = data.map((fila) => {
      const keys = Object.keys(fila);

      // Búsqueda flexible de nombres de columnas
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

  // Descargar plantilla de ejemplo lista para usar
  const handleDescargarPlantilla = (formato: "xlsx" | "csv") => {
    const ejemplo = [
      { nombre: "Familia Gómez Pérez", pases: 4, grupo: "Familia de la Novia" },
      { nombre: "Carlos Mendoza y Acompañante", pases: 2, grupo: "Amigos de Luis" },
      { nombre: "Dra. Sofía Alarcón", pases: 1, grupo: "Colegas" },
      { nombre: "Familia Treviño Morales", pases: 3, grupo: "Familia del Novio" },
      { nombre: "Mateo Silva & Pareja", pases: 2, grupo: "Amigos de la Novia" },
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

  // Guardar importación masiva en base de datos (RF-10)
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

  // Helper de badges según RF-26
  const renderBadgeEstado = (estado: Invitado["estado"]) => {
    switch (estado) {
      case "confirmado":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Confirmado
          </span>
        );
      case "declinado":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Declinado
          </span>
        );
      case "visto":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Visto
          </span>
        );
      case "pendiente":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
            Pendiente
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera y botones principales */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-stone-900">
            Gestión de Invitados
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Control de pases personalizados, generación de enlaces y confirmaciones
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalImportar(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-stone-300 hover:bg-[#faf8f5] text-stone-700 text-xs font-semibold rounded-xl transition-all shadow-sm"
          >
            <Upload className="w-4 h-4 text-[#ab8153]" />
            <span>Importar CSV / Excel</span>
          </button>

          <button
            onClick={() => {
              setFormNombre("");
              setFormGrupo("");
              setFormPases(2);
              setFormError(null);
              setModalAgregar(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-[#946943] text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4 text-[#c5a059]" />
            <span>+ Agregar Invitado</span>
          </button>
        </div>
      </div>

      {/* Mini KPIs de la sección */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white p-4 rounded-2xl border border-stone-200 shadow-sm text-center">
          <div>
            <p className="text-[11px] uppercase font-semibold text-stone-400">Total Pases</p>
            <p className="text-xl font-serif font-bold text-stone-800">{kpis.total_asignados}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase font-semibold text-emerald-600">Confirmados</p>
            <p className="text-xl font-serif font-bold text-emerald-700">{kpis.total_confirmados}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase font-semibold text-rose-600">Declinados</p>
            <p className="text-xl font-serif font-bold text-rose-700">{kpis.total_declinados}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase font-semibold text-stone-500">Pendientes</p>
            <p className="text-xl font-serif font-bold text-stone-700">{kpis.total_pendientes}</p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[11px] uppercase font-semibold text-[#ab8153]">Pases Liberados</p>
            <p className="text-xl font-serif font-bold text-[#795337]">{kpis.pases_liberados}</p>
          </div>
        </div>
      )}

      {/* Barra de Filtros y Búsqueda (RF-11) */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o grupo..."
            className="w-full pl-10 pr-4 py-2 bg-[#faf8f5] border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-stone-400 shrink-0" />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-[#faf8f5] border border-stone-200 rounded-xl text-xs text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">⚪ Pendientes</option>
            <option value="visto">🔵 Vistos</option>
            <option value="confirmado">🟢 Confirmados</option>
            <option value="declinado">🔴 Declinados</option>
          </select>
        </div>
      </div>

      {/* Tabla de Invitados */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#faf8f5] border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Invitado / Familia</th>
                <th className="py-3.5 px-4">Grupo</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-center">Pases (Conf / Asign)</th>
                <th className="py-3.5 px-4">Última Respuesta</th>
                <th className="py-3.5 px-4 text-right">Acciones de Enlace</th>
                <th className="py-3.5 px-4 text-center">Editar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    Cargando lista de invitados...
                  </td>
                </tr>
              ) : invitados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    No se encontraron invitados con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                invitados.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#faf8f5]/60 transition-colors">
                    {/* Nombre */}
                    <td className="py-3.5 px-4 font-semibold text-stone-900">
                      <div>{inv.nombre}</div>
                      <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                        Token: {inv.token.substring(0, 6)}•••
                      </div>
                    </td>

                    {/* Grupo */}
                    <td className="py-3.5 px-4 text-stone-500">
                      {inv.grupo ? (
                        <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md font-medium text-[11px]">
                          {inv.grupo}
                        </span>
                      ) : (
                        <span className="text-stone-300">-</span>
                      )}
                    </td>

                    {/* Estado RF-26 */}
                    <td className="py-3.5 px-4 text-center">{renderBadgeEstado(inv.estado)}</td>

                    {/* Pases RF-27 */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-semibold text-stone-900">
                        {inv.pases_confirmados !== null ? inv.pases_confirmados : "-"}
                      </span>
                      <span className="text-stone-400"> / {inv.pases_asignados}</span>
                    </td>

                    {/* Fecha de respuesta RF-28 */}
                    <td className="py-3.5 px-4 text-stone-500">
                      {formatDateTimeMx(inv.ultima_respuesta_en)}
                    </td>

                    {/* Acciones de envío RF-16, RF-17, RF-13 */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Botón Copiar mensaje */}
                        <button
                          onClick={() => handleCopiarMensaje(inv)}
                          title="Copiar mensaje con enlace"
                          className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg border border-stone-200 transition-colors"
                        >
                          {copiadoId === inv.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Botón WhatsApp */}
                        <button
                          onClick={() => handleAbrirWhatsApp(inv)}
                          title="Enviar por WhatsApp"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-xs transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span className="text-[11px]">WhatsApp</span>
                        </button>

                        {/* Botón Regenerar link */}
                        <button
                          onClick={() => handleRegenerarLink(inv)}
                          title="Regenerar link (invalida el anterior)"
                          className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Editar / Borrar RF-09 */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleAbrirEditar(inv)}
                          title="Editar"
                          className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModalEliminar(inv)}
                          title="Eliminar"
                          className="p-1 text-stone-400 hover:text-rose-600 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: AGREGAR INVITADO (RF-08) */}
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
                  className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                  Grupo (opcional)
                </label>
                <input
                  type="text"
                  placeholder="ej. Familia de la Novia, Amigos Universidad"
                  value={formGrupo}
                  onChange={(e) => setFormGrupo(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  Útil para clasificar y distinguir homónimos.
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
                  className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
                />
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
                  className="px-5 py-2.5 bg-stone-900 hover:bg-[#946943] text-white text-xs font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : "Guardar Invitado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR INVITADO (RF-09, RN-02) */}
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
                  className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
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
                  className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
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
                  className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
                />
                {modalEditar.pases_confirmados !== null && (
                  <p className="text-[11px] text-stone-500 mt-1">
                    Confirmados actualmente: <strong>{modalEditar.pases_confirmados}</strong>.
                  </p>
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
                  className="px-5 py-2.5 bg-stone-900 hover:bg-[#946943] text-white text-xs font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {guardando ? "Actualizando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ELIMINAR INVITADO (RF-09, RF-15) */}
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
              <strong>&ldquo;Invitación no disponible&rdquo;</strong> si alguien intenta abrirlo (RF-15).
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

      {/* MODAL: IMPORTACIÓN MASIVA CSV/EXCEL (RF-10) */}
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
                    ? "border-[#c5a059] bg-[#fdf9f2] scale-[1.01]"
                    : "border-stone-200 bg-[#faf8f5]/50 hover:bg-[#faf8f5] hover:border-stone-300"
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
                  <div className="w-16 h-16 rounded-2xl bg-white border border-[#e6d7c3] flex items-center justify-center text-[#c5a059] mb-4 shadow-xs">
                    <FileUp className="w-8 h-8 text-[#c5a059]" />
                  </div>

                  <h4 className="font-semibold text-stone-900 text-sm mb-1">
                    {isDragging
                      ? "¡Suelta tu archivo aquí!"
                      : "Arrastra tu archivo aquí o haz clic para seleccionarlo"}
                  </h4>

                  <p className="text-xs text-stone-500 max-w-sm mb-4">
                    Admite <strong>.xlsx (Excel)</strong> o <strong>.csv</strong>. Columnas reconocidas: <code>nombre</code>, <code>pases</code> y opcionalmente <code>grupo</code>.
                  </p>

                  <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 hover:bg-[#946943] text-white text-xs font-semibold rounded-xl shadow-sm transition-all pointer-events-none">
                    <Upload className="w-4 h-4 text-[#c5a059]" />
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#faf8f5] text-stone-700 border border-stone-200 rounded-lg font-medium text-[11px] transition-colors shadow-xs"
                    >
                      <Download className="w-3 h-3 text-[#ab8153]" />
                      <span>Descargar Plantilla Excel (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDescargarPlantilla("csv")}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#faf8f5] text-stone-700 border border-stone-200 rounded-lg font-medium text-[11px] transition-colors shadow-xs"
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
                  <div className="flex items-center justify-between bg-[#faf8f5] px-3.5 py-2 rounded-xl border border-stone-200 text-xs">
                    <span className="text-stone-500">
                      Archivo: <strong className="text-stone-800">{nombreArchivo}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setResumenImportacion(null);
                        setFilasImportadas([]);
                        setNombreArchivo(null);
                      }}
                      className="text-[#ab8153] hover:underline font-semibold text-[11px]"
                    >
                      Cambiar archivo
                    </button>
                  </div>
                )}

                {/* Resumen de validación (RF-10) */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#faf8f5] p-3 rounded-xl border border-stone-200 text-center">
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
                    <thead className="bg-[#faf8f5] border-b border-stone-200 text-stone-500 font-semibold">
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
                    }}
                    className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={resumenImportacion.validos === 0 || importando}
                    onClick={handleGuardarImportacion}
                    className="px-5 py-2.5 bg-stone-900 hover:bg-[#946943] text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
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
