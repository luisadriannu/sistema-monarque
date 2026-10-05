const XLSX = require("xlsx");
const fs = require("fs");

const invitadosEjemplo = [
  { nombre: "Familia Herrera Domínguez", pases: 4, grupo: "Familia de la Novia" },
  { nombre: "Lic. Roberto Garza", pases: 2, grupo: "Amigos de Trabajo" },
  { nombre: "Dra. Marcela Fuentes", pases: 1, grupo: "Amigos Universidad" },
  { nombre: "Familia Santos Vega", pases: 5, grupo: "Familia del Novio" },
  { nombre: "Javier Ochoa y Pareja", pases: 2, grupo: "Amigos de Luis" },
];

// 1. Guardar CSV
const headerCsv = "nombre,pases,grupo\n";
const lineasCsv = invitadosEjemplo
  .map((i) => `"${i.nombre}",${i.pases},"${i.grupo}"`)
  .join("\n");
fs.writeFileSync("plantilla_invitados_ejemplo.csv", headerCsv + lineasCsv, "utf8");

// 2. Guardar Excel (.xlsx)
const worksheet = XLSX.utils.json_to_sheet(invitadosEjemplo);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Invitados");
XLSX.writeFile(workbook, "plantilla_invitados_ejemplo.xlsx");

console.log("✅ Plantillas de ejemplo creadas: plantilla_invitados_ejemplo.csv y .xlsx");
