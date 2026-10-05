"use client";

import { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Download,
  Printer,
  Sparkles,
  Users,
  UtensilsCrossed,
  CheckCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateLongMx, formatDateTimeMx } from "@/lib/utils";

interface Invitado {
  id: string;
  nombre: string;
  grupo: string | null;
  pases_asignados: number;
  pases_confirmados: number | null;
  estado: string;
  ultima_respuesta_en: string | null;
}

interface Evento {
  id: string;
  nombre: string;
  anfitriones: string;
  fecha_evento: string;
  lugar: string;
}

export default function ExportarPage() {
  const [evento, setEvento] = useState<Evento | null>(null);
  const [confirmados, setConfirmados] = useState<Invitado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/invitados?estado=confirmado");
        const data = await res.json();
        if (res.ok) {
          setEvento(data.evento);
          setConfirmados(data.invitados || []);
        }
      } catch (e) {
        console.error("Error al cargar lista de confirmados", e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const totalPlatillos = confirmados.reduce(
    (sum, inv) => sum + (inv.pases_confirmados || 0),
    0
  );

  // RF-29: Exportar a Excel (.xlsx) con SheetJS
  const handleExportExcel = () => {
    if (!evento) return;

    const filas = confirmados.map((inv, index) => ({
      "#": index + 1,
      "Invitado / Familia": inv.nombre,
      "Grupo / Familia": inv.grupo || "General",
      "Pases Confirmados (Platillos)": inv.pases_confirmados || 0,
      "Fecha de Confirmación": formatDateTimeMx(inv.ultima_respuesta_en),
    }));

    // Fila de resumen total
    filas.push({
      "#": "" as unknown as number,
      "Invitado / Familia": "TOTAL GENERAL DE PLATILLOS",
      "Grupo / Familia": "",
      "Pases Confirmados (Platillos)": totalPlatillos,
      "Fecha de Confirmación": "",
    });

    const worksheet = XLSX.utils.json_to_sheet(filas);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Confirmados Banquetera");

    const fileName = `Monarque_Lista_Banquete_${evento.nombre.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // RF-29: Exportar a PDF con jsPDF y jspdf-autotable
  const handleExportPDF = () => {
    if (!evento) return;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Encabezado elegante Monarque
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 27, 25);
    doc.text("MONARQUE • PLAN ELITE", 14, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Lista de Asistencia Confirmada para Banquetera y Salón`, 14, 27);

    // Detalles del Evento
    doc.setDrawColor(214, 188, 157); // Dorado suave
    doc.line(14, 31, 196, 31);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(`Evento: ${evento.nombre}`, 14, 38);
    doc.text(`Anfitriones: ${evento.anfitriones}`, 14, 44);
    doc.text(`Fecha: ${formatDateLongMx(evento.fecha_evento)}`, 14, 50);
    doc.text(`Lugar: ${evento.lugar}`, 14, 56);

    // Cuadro de Resumen de Platillos
    doc.setFillColor(250, 248, 245);
    doc.roundedRect(130, 34, 66, 25, 3, 3, "F");
    doc.setFontSize(9);
    doc.setTextColor(171, 129, 83);
    doc.text("TOTAL PLATILLOS A PREPARAR", 135, 41);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 27, 25);
    doc.text(`${totalPlatillos} Platillos`, 135, 52);

    // Tabla de confirmados
    const bodyData = confirmados.map((inv, idx) => [
      idx + 1,
      inv.nombre,
      inv.grupo || "-",
      `${inv.pases_confirmados || 0} pases`,
      formatDateTimeMx(inv.ultima_respuesta_en),
    ]);

    autoTable(doc, {
      startY: 65,
      head: [["#", "Invitado / Familia", "Grupo", "Platillos Conf.", "Fecha Confirmación"]],
      body: bodyData,
      theme: "striped",
      headStyles: {
        fillColor: [28, 25, 23], // stone-900
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        textColor: [50, 50, 50],
      },
      alternateRowStyles: {
        fillColor: [250, 248, 245],
      },
      foot: [["", "TOTAL GENERAL", "", `${totalPlatillos} platillos`, ""]],
      footStyles: {
        fillColor: [243, 237, 227],
        textColor: [30, 27, 25],
        fontStyle: "bold",
        fontSize: 9,
      },
    });

    const fileName = `Monarque_Lista_Banquete_${evento.nombre.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    doc.save(fileName);
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-stone-400 text-sm">
        Cargando lista de confirmaciones...
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="p-8 text-center text-stone-600">
        No se encontró el evento.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-widest font-semibold text-[#ab8153]">
              RF-29 • Entrega a Proveedores
            </span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-stone-900">
            Exportar Lista de Confirmados
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Genera la lista depurada de platillos confirmados para entregar al salón o a la banquetera
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            disabled={confirmados.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Descargar Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={confirmados.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-[#946943] text-white text-xs font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-[#c5a059]" />
            <span>Descargar PDF</span>
          </button>
        </div>
      </div>

      {/* Tarjeta de Resumen para la Banquetera */}
      <div className="bg-white border border-[#e6d7c3] rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Evento y Sede
            </span>
            <h3 className="font-serif text-xl font-bold text-stone-900">{evento.nombre}</h3>
            <p className="text-xs text-stone-600">{evento.lugar}</p>
          </div>

          <div className="bg-[#faf8f5] p-5 rounded-2xl border border-stone-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase">
                Total Platillos Confirmados
              </p>
              <p className="text-3xl font-serif font-bold text-stone-900">
                {totalPlatillos}
              </p>
            </div>
          </div>

          <div className="bg-[#faf8f5] p-5 rounded-2xl border border-stone-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase">
                Familias / Grupos Confirmados
              </p>
              <p className="text-3xl font-serif font-bold text-stone-900">
                {confirmados.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla Vista Previa */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 bg-[#faf8f5] border-b border-stone-200 flex items-center justify-between">
          <h4 className="font-serif font-bold text-sm text-stone-900">
            Vista Previa de la Lista para Banquete
          </h4>
          <span className="text-xs text-stone-500">
            {confirmados.length} registros confirmados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#faf8f5] border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Invitado / Familia</th>
                <th className="py-3 px-4">Grupo</th>
                <th className="py-3 px-4 text-center">Platillos Confirmados</th>
                <th className="py-3 px-4">Fecha y Hora de Confirmación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {confirmados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-400">
                    Aún no hay invitados confirmados para exportar.
                  </td>
                </tr>
              ) : (
                confirmados.map((inv, idx) => (
                  <tr key={inv.id} className="hover:bg-[#faf8f5]/60 transition-colors">
                    <td className="py-3 px-4 text-center text-stone-400 font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-semibold text-stone-900">
                      {inv.nombre}
                    </td>
                    <td className="py-3 px-4 text-stone-500">
                      {inv.grupo || "General"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 text-xs">
                        {inv.pases_confirmados} {inv.pases_confirmados === 1 ? "platillo" : "platillos"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-500">
                      {formatDateTimeMx(inv.ultima_respuesta_en)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {confirmados.length > 0 && (
              <tfoot className="bg-[#f3ede3] font-bold text-stone-900 text-xs border-t-2 border-[#d5bc9d]">
                <tr>
                  <td colSpan={3} className="py-3.5 px-4 text-right uppercase tracking-wider">
                    Total Platillos a Pagar Banquetera:
                  </td>
                  <td className="py-3.5 px-4 text-center text-base font-serif text-[#53392a]">
                    {totalPlatillos}
                  </td>
                  <td className="py-3.5 px-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
