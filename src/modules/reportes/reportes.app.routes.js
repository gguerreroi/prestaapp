import { Router } from "express";
import path from "path";

import ExcelJS from "exceljs";
import puppeteer from "puppeteer";
import ejs from "ejs";
import appAuth from "../../middlewares/auth/app-auth.middleware";
import requirePermission from "../../middlewares/auth/permission.middleware";
import { dbQuery } from "../../config/db.query";

const router = Router();

// ─── Función reutilizable: obtiene los datos del reporte de cobranza semanal ───
async function getCobranzaSemanalData(query) {
  let lunes;
  if (query.semana) {
    lunes = new Date(query.semana + "T00:00:00");
  } else {
    lunes = new Date();
    const day = lunes.getDay();
    const diff = day === 0 ? 6 : day - 1;
    lunes.setDate(lunes.getDate() - diff);
  }
  lunes.setHours(0, 0, 0, 0);

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const diasSemana = [];
  const nombresdia = [
    "Lunes",
    "Martes",
    "Miercoles",
    "Jueves",
    "Viernes",
    "Sabado",
    "Domingo",
  ];
  for (let i = 0; i < 7; i++) {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    diasSemana.push({
      nombre: nombresdia[i],
      fecha: d.toISOString().slice(0, 10),
      fechaCorta: `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`,
    });
  }

  const fechaLunes = lunes.toISOString().slice(0, 10);
  const fechaDomingo = domingo.toISOString().slice(0, 10);

  const lunesAnterior = new Date(lunes);
  lunesAnterior.setDate(lunes.getDate() - 7);
  const lunesSiguiente = new Date(lunes);
  lunesSiguiente.setDate(lunes.getDate() + 7);

  const filtroAgenteId = query.agente ? Number(query.agente) : null;
  const whereAgente = filtroAgenteId ? "AND c.cartera_id = @agenteId" : "";

  const queryParams = { fechaLunes, fechaDomingo };
  if (filtroAgenteId) queryParams.agenteId = filtroAgenteId;

  const rows = await dbQuery(
    `
		SELECT
			p.prestamo_id,
			c.cui9,
			c.nombres + ' ' + c.apellidos AS cliente_nombre,
			ISNULL(a.nombres + ' ' + ISNULL(a.apellidos,''), 'Sin agente') AS agente_nombre,
			c.cartera_id,
			p.principal,
			ISNULL(p.total_pagar,0) - ISNULL(p.principal,0) AS interes,
			p.cuota_diaria,
			p.total_pagar,
			(p.total_pagar - ISNULL(pagado.total_pagado, 0)) AS saldo,
			d.fecha_cuota,
			d.cuota_programada,
			d.monto_pagado,
			d.estado AS estado_cuota
		FROM prestamos.core p
		JOIN clientes.core c ON c.cui9 = p.cui9
		LEFT JOIN prestamos.agentes a ON a.agente_id = c.cartera_id
		LEFT JOIN prestamos.detalle d
			ON d.prestamo_id = p.prestamo_id
			AND d.fecha_cuota BETWEEN @fechaLunes AND @fechaDomingo
		LEFT JOIN (
			SELECT prestamo_id, SUM(monto_pagado) AS total_pagado
			FROM prestamos.detalle
			GROUP BY prestamo_id
		) pagado ON pagado.prestamo_id = p.prestamo_id
		WHERE p.estado = 'ACTIVO'
		${whereAgente}
		ORDER BY c.apellidos, c.nombres, p.prestamo_id, d.fecha_cuota
	`,
    queryParams,
  );

  const prestamosMap = new Map();
  for (const row of rows) {
    const key = row.prestamo_id;
    if (!prestamosMap.has(key)) {
      prestamosMap.set(key, {
        prestamo_id: row.prestamo_id,
        cui9: row.cui9,
        cliente_nombre: row.cliente_nombre,
        agente_nombre: row.agente_nombre,
        cartera_id: row.cartera_id,
        principal: row.principal,
        interes: row.interes,
        cuota_diaria: row.cuota_diaria,
        total_pagar: row.total_pagar,
        saldo: row.saldo,
        dias: {},
      });
    }
    if (row.fecha_cuota) {
      const fechaKey = new Date(row.fecha_cuota).toISOString().slice(0, 10);
      prestamosMap.get(key).dias[fechaKey] = {
        cuota_programada: row.cuota_programada,
        monto_pagado: row.monto_pagado,
        estado_cuota: row.estado_cuota,
      };
    }
  }

  const prestamos = Array.from(prestamosMap.values());

  const agentes = await dbQuery(`
		SELECT agente_id, codigo, nombres + ' ' + ISNULL(apellidos,'') AS nombre
		FROM prestamos.agentes
		WHERE _estado = 'AC'
		ORDER BY nombres
	`);

  return {
    diasSemana,
    fechaLunes,
    fechaDomingo,
    semanaAnterior: lunesAnterior.toISOString().slice(0, 10),
    semanaSiguiente: lunesSiguiente.toISOString().slice(0, 10),
    prestamos,
    agentes,
    filtroAgente: query.agente || "",
  };
}

// ─── Rutas ──────────────────────────────────────────────────────────────────────

// URL base: /reportes
router.get("/", appAuth, requirePermission("/reportes"), (req, res) => {
  res.render("reportes/reportes", {
    title: "Reportes",
  });
});

// ─── Excel export ───
router.get(
  "/cobranza-semanal/excel",
  appAuth,
  requirePermission("/reportes"),
  async (req, res) => {
    try {
      const data = await getCobranzaSemanalData(req.query);
      const { prestamos, diasSemana, fechaLunes, fechaDomingo } = data;

      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Cobranza Semanal");

      // Título
      const agenteName = data.filtroAgente
        ? data.agentes.find((a) => a.agente_id == data.filtroAgente)?.nombre ||
          ""
        : "Todos";
      ws.mergeCells("A1", `M1`);
      const titleCell = ws.getCell("A1");
      titleCell.value = `Cobranza Semanal — ${diasSemana[0].fechaCorta} al ${diasSemana[6].fechaCorta} — Agente: ${agenteName}`;
      titleCell.font = { bold: true, size: 13 };
      titleCell.alignment = { horizontal: "center" };

      // Encabezados
      const headers = [
        "No.",
        "Cliente",
        "Principal",
        "Interés",
        "Total",
        "Saldo",
        ...diasSemana.map((d) => `${d.nombre}\n${d.fechaCorta}`),
      ];
      const headerRow = ws.addRow(headers);
      headerRow.font = { bold: true, size: 9 };
      headerRow.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE8E8E8" },
        };
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Anchos de columna
      ws.getColumn(1).width = 5;
      ws.getColumn(2).width = 28;
      ws.getColumn(3).width = 12;
      ws.getColumn(4).width = 12;
      ws.getColumn(5).width = 12;
      ws.getColumn(6).width = 12;
      for (let i = 7; i <= 13; i++) ws.getColumn(i).width = 12;

      const currencyFmt = '"Q"#,##0';

      // Datos
      prestamos.forEach((p, idx) => {
        const rowValues = [
          idx + 1,
          p.cliente_nombre,
          p.principal,
          p.interes,
          p.total_pagar,
          p.saldo,
        ];

        diasSemana.forEach((dia) => {
          const cuota = p.dias[dia.fecha];
          if (cuota) {
            rowValues.push(
              cuota.estado_cuota === "PAGADO"
                ? cuota.monto_pagado
                : cuota.cuota_programada,
            );
          } else {
            rowValues.push(null);
          }
        });

        const row = ws.addRow(rowValues);
        row.font = { size: 9 };

        // Formato moneda para columnas C-F y días
        for (let c = 3; c <= 13; c++) {
          const cell = row.getCell(c);
          if (cell.value != null) {
            cell.numFmt = currencyFmt;
            cell.alignment = { horizontal: "right" };
          }
        }

        // Colores para estados de cuota
        diasSemana.forEach((dia, i) => {
          const cuota = p.dias[dia.fecha];
          const cell = row.getCell(7 + i);
          cell.alignment = { horizontal: "center" };
          if (cuota) {
            if (cuota.estado_cuota === "PAGADO") {
              cell.font = { size: 9, color: { argb: "FF1B7A1B" } };
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE8F5E9" },
              };
            } else if (
              cuota.estado_cuota === "ATRASADO" ||
              cuota.estado_cuota === "MOROSO"
            ) {
              cell.font = { size: 9, color: { argb: "FFC62828" } };
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFDE8E8" },
              };
            }
          }
        });

        // Bordes
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD0D0D0" } },
            bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
            left: { style: "thin", color: { argb: "FFD0D0D0" } },
            right: { style: "thin", color: { argb: "FFD0D0D0" } },
          };
        });
      });

      // Fila de totales
      if (prestamos.length > 0) {
        const totals = [
          "",
          "TOTALES",
          prestamos.reduce((s, p) => s + p.principal, 0),
          prestamos.reduce((s, p) => s + p.interes, 0),
          prestamos.reduce((s, p) => s + p.total_pagar, 0),
          prestamos.reduce((s, p) => s + p.saldo, 0),
        ];

        diasSemana.forEach((dia) => {
          let totalDia = 0;
          prestamos.forEach((p) => {
            const cuota = p.dias[dia.fecha];
            if (cuota)
              totalDia +=
                cuota.estado_cuota === "PAGADO"
                  ? cuota.monto_pagado
                  : cuota.cuota_programada;
          });
          totals.push(totalDia || null);
        });

        const totRow = ws.addRow(totals);
        totRow.font = { bold: true, size: 9 };
        totRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDCE6F0" },
          };
          cell.border = {
            top: { style: "medium" },
            bottom: { style: "medium" },
            left: { style: "thin" },
            right: { style: "thin" },
          };
        });
        for (let c = 3; c <= 13; c++) {
          const cell = totRow.getCell(c);
          if (cell.value != null) {
            cell.numFmt = currencyFmt;
            cell.alignment = { horizontal: "right" };
          }
        }
      }

      const filename = `cobranza-semanal-${fechaLunes}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error("Error en cobranza-semanal/excel:", err);
      res.status(500).json({ error: "Error al generar el archivo Excel" });
    }
  },
);

// ─── PDF export ───
router.get(
  "/cobranza-semanal/pdf",
  appAuth,
  requirePermission("/reportes"),
  async (req, res) => {
    let browser = null;
    try {
      const data = await getCobranzaSemanalData(req.query);

      const agenteName = data.filtroAgente
        ? data.agentes.find((a) => a.agente_id == data.filtroAgente)?.nombre ||
          ""
        : "Todos";

      const templatePath = path.resolve(
        __dirname,
        "../../views/reportes/cobranza-semanal-print.ejs",
      );
      const html = await ejs.renderFile(templatePath, { ...data, agenteName });

      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "Legal",
        landscape: true,
        printBackground: true,
        margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" },
      });

      const filename = `cobranza-semanal-${data.fechaLunes}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${filename}"`,
      );
      res.send(pdfBuffer);
    } catch (err) {
      console.error("Error en cobranza-semanal/pdf:", err);
      res.status(500).json({ error: "Error al generar el PDF" });
    } finally {
      if (browser) await browser.close();
    }
  },
);

// ─── Vista HTML ───
router.get(
  "/cobranza-semanal",
  appAuth,
  requirePermission("/reportes"),
  async (req, res) => {
    try {
      const data = await getCobranzaSemanalData(req.query);

      res.render("reportes/cobranza-semanal", {
        title: "Cobranza Semanal",
        pageScripts: ["/assets/js/custom/cobranza-semanal.js"],
        ...data,
      });
    } catch (err) {
      console.error("Error en cobranza-semanal:", err);
      res.status(500).render("error/500", { error: err.message });
    }
  },
);

export default router;
