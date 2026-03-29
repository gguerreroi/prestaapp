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
			ISNULL(p.cobro_admon, 0) AS cobro_admon,
			p.fecha_pago_cobro_admon,
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
        cobro_admon: row.cobro_admon,
        cobro_admon_pagado: !!row.fecha_pago_cobro_admon,
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
      ws.mergeCells("A1", `N1`);
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
        "Admon.",
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
      ws.getColumn(7).width = 10;
      for (let i = 8; i <= 14; i++) ws.getColumn(i).width = 12;

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
          p.cobro_admon || 0,
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

        // Formato moneda para columnas C-G y días
        for (let c = 3; c <= 14; c++) {
          const cell = row.getCell(c);
          if (cell.value != null) {
            cell.numFmt = currencyFmt;
            cell.alignment = { horizontal: "right" };
          }
        }

        // Colores para estados de cuota
        diasSemana.forEach((dia, i) => {
          const cuota = p.dias[dia.fecha];
          const cell = row.getCell(8 + i);
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
          prestamos.reduce((s, p) => s + (p.cobro_admon || 0), 0),
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
        for (let c = 3; c <= 14; c++) {
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

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTE MENSUAL
// ═══════════════════════════════════════════════════════════════════════════════

function getSemanasDelMes(year, month) {
  const lastDay = new Date(year, month, 0).getDate(); // último día del mes
  return [
    { label: '1-7', inicio: 1, fin: 7 },
    { label: '8-14', inicio: 8, fin: 14 },
    { label: '15-21', inicio: 15, fin: 21 },
    { label: `22-${lastDay}`, inicio: 22, fin: lastDay },
  ];
}

function getSemanaIndex(day) {
  if (day <= 7) return 0;
  if (day <= 14) return 1;
  if (day <= 21) return 2;
  return 3;
}

const nombresMes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

async function getCobranzaMensualData(query) {
  let year, month;
  if (query.mes && /^\d{4}-\d{2}$/.test(query.mes)) {
    const parts = query.mes.split('-');
    year = Number(parts[0]);
    month = Number(parts[1]);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const fechaInicio = `${year}-${String(month).padStart(2,'0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const fechaFin = `${year}-${String(month).padStart(2,'0')}-${lastDay}`;
  const mesLabel = `${nombresMes[month - 1]} ${year}`;

  // Mes anterior / siguiente
  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const mesAnterior = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2,'0')}`;
  const mesSiguiente = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2,'0')}`;

  const semanas = getSemanasDelMes(year, month);

  const filtroAgenteId = query.agente ? Number(query.agente) : null;
  const whereAgente = filtroAgenteId ? 'AND c.cartera_id = @agenteId' : '';

  const queryParams = { fechaInicio, fechaFin };
  if (filtroAgenteId) queryParams.agenteId = filtroAgenteId;

  // Query principal: préstamos activos con detalle del mes
  const rows = await dbQuery(`
    SELECT
      p.prestamo_id,
      c.cui9,
      c.nombres + ' ' + c.apellidos AS cliente_nombre,
      ISNULL(a.nombres + ' ' + ISNULL(a.apellidos,''), 'Sin agente') AS agente_nombre,
      c.cartera_id,
      p.principal,
      p.cuota_diaria,
      p.total_pagar,
      p.fecha_inicio,
      DATEADD(DAY, p.plazo_dias - 1, p.fecha_inicio) AS fecha_fin,
      ISNULL(p.cobro_admon, 0) AS cobro_admon,
      p.fecha_pago_cobro_admon,
      (p.total_pagar - ISNULL(pagado.total_pagado, 0)) AS saldo,
      d.fecha_cuota,
      d.cuota_programada,
      d.monto_pagado,
      d.mora,
      d.estado AS estado_cuota
    FROM prestamos.core p
    JOIN clientes.core c ON c.cui9 = p.cui9
    LEFT JOIN prestamos.agentes a ON a.agente_id = c.cartera_id
    LEFT JOIN prestamos.detalle d
      ON d.prestamo_id = p.prestamo_id
      AND d.fecha_cuota BETWEEN @fechaInicio AND @fechaFin
    LEFT JOIN (
      SELECT prestamo_id, SUM(monto_pagado) AS total_pagado
      FROM prestamos.detalle
      GROUP BY prestamo_id
    ) pagado ON pagado.prestamo_id = p.prestamo_id
    WHERE p.estado = 'ACTIVO'
    ${whereAgente}
    ORDER BY c.apellidos, c.nombres, p.prestamo_id, d.fecha_cuota
  `, queryParams);

  // Agrupar por préstamo y por semana
  const prestamosMap = new Map();
  for (const row of rows) {
    const key = row.prestamo_id;
    if (!prestamosMap.has(key)) {
      // Determinar en qué semana cae el cobro admon (por fecha_inicio)
      const fechaInicioDate = new Date(row.fecha_inicio);
      const admonSemIdx = (fechaInicioDate.getUTCMonth() + 1 === month && fechaInicioDate.getUTCFullYear() === year)
        ? getSemanaIndex(fechaInicioDate.getUTCDate())
        : -1;
      const admonCobrado = !!row.fecha_pago_cobro_admon;
      const admonEnMes = admonSemIdx >= 0;

      prestamosMap.set(key, {
        prestamo_id: row.prestamo_id,
        cui9: row.cui9,
        cliente_nombre: row.cliente_nombre,
        agente_nombre: row.agente_nombre,
        principal: row.principal,
        cuota_diaria: row.cuota_diaria,
        total_pagar: row.total_pagar,
        fecha_inicio: row.fecha_inicio,
        fecha_fin: row.fecha_fin,
        cobro_admon: row.cobro_admon,
        cobro_admon_pagado: admonCobrado,
        admon_sem_idx: admonSemIdx,
        admon_en_mes: admonEnMes,
        saldo: row.saldo,
        semanas: [
          { cuota: 0, mora: 0, admon: 0 },
          { cuota: 0, mora: 0, admon: 0 },
          { cuota: 0, mora: 0, admon: 0 },
          { cuota: 0, mora: 0, admon: 0 },
        ],
      });

      // Asignar cobro admon a la semana correspondiente
      if (admonEnMes && admonCobrado) {
        prestamosMap.get(key).semanas[admonSemIdx].admon = row.cobro_admon;
      }
    }

    // Agrupar cuotas por semana
    if (row.fecha_cuota) {
      const cuotaDate = new Date(row.fecha_cuota);
      const day = cuotaDate.getUTCDate();
      const semIdx = getSemanaIndex(day);
      const p = prestamosMap.get(key);
      p.semanas[semIdx].cuota += (row.monto_pagado || 0);
      p.semanas[semIdx].mora += (row.mora || 0);
    }
  }

  const prestamos = Array.from(prestamosMap.values());

  // KPIs
  const capitalColocadoMes = await dbQuery(`
    SELECT ISNULL(SUM(principal), 0) AS total
    FROM prestamos.core
    WHERE fecha_inicio BETWEEN @fechaInicio AND @fechaFin
    ${whereAgente ? whereAgente.replace('c.cartera_id', 'cartera_id_sub') : ''}
  `.replace('cartera_id_sub', `(SELECT cartera_id FROM clientes.core WHERE cui9 = prestamos.core.cui9)`),
  queryParams);

  const cobradoEnMes = await dbQuery(`
    SELECT ISNULL(SUM(d.monto_pagado), 0) AS total
    FROM prestamos.detalle d
    JOIN prestamos.core p ON p.prestamo_id = d.prestamo_id
    JOIN clientes.core c ON c.cui9 = p.cui9
    WHERE d.fecha_cuota BETWEEN @fechaInicio AND @fechaFin
    ${whereAgente}
  `, queryParams);

  const agentes = await dbQuery(`
    SELECT agente_id, codigo, nombres + ' ' + ISNULL(apellidos,'') AS nombre
    FROM prestamos.agentes
    WHERE _estado = 'AC'
    ORDER BY nombres
  `);

  return {
    year,
    month,
    mesLabel,
    mesActual: `${year}-${String(month).padStart(2,'0')}`,
    mesAnterior,
    mesSiguiente,
    semanas,
    prestamos,
    agentes,
    filtroAgente: query.agente || '',
    kpis: {
      capitalColocadoMes: capitalColocadoMes[0]?.total || 0,
      cobradoEnMes: cobradoEnMes[0]?.total || 0,
      totalSaldo: prestamos.reduce((s, p) => s + p.saldo, 0),
    }
  };
}

// ─── Mensual Excel ───
router.get('/cobranza-mensual/excel', appAuth, requirePermission('/reportes'), async (req, res) => {
  try {
    const data = await getCobranzaMensualData(req.query);
    const { prestamos, semanas } = data;

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Cobranza Mensual');

    const agenteName = data.filtroAgente
      ? data.agentes.find(a => a.agente_id == data.filtroAgente)?.nombre || ''
      : 'Todos';

    // Título
    ws.mergeCells('A1', 'R1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `Cobranza Mensual — ${data.mesLabel} — Agente: ${agenteName}`;
    titleCell.font = { bold: true, size: 13 };
    titleCell.alignment = { horizontal: 'center' };

    // Header row 1 (grupos)
    const h1 = ws.addRow([
      '', '', '', '', '', '',
      ...semanas.flatMap(s => [s.label, '', '']),
      'TOTAL', '', ''
    ]);
    h1.font = { bold: true, size: 8 };
    h1.alignment = { horizontal: 'center' };
    // Merge semana headers
    for (let i = 0; i < 4; i++) {
      const col = 7 + i * 3;
      ws.mergeCells(3, col, 3, col + 2);
    }
    ws.mergeCells(3, 19, 3, 21);

    // Header row 2 (sub-columnas)
    const headers = [
      'No.', 'Cliente', 'F.Inicio', 'F.Fin', 'Principal', 'Saldo',
      ...semanas.flatMap(() => ['Cuota', 'Mora', 'Admon']),
      'Cuota', 'Mora', 'Admon'
    ];
    const h2 = ws.addRow(headers);
    h2.font = { bold: true, size: 8 };
    h2.alignment = { horizontal: 'center', wrapText: true };
    h2.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Anchos
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 25;
    ws.getColumn(3).width = 11;
    ws.getColumn(4).width = 11;
    ws.getColumn(5).width = 11;
    ws.getColumn(6).width = 11;
    for (let i = 7; i <= 21; i++) ws.getColumn(i).width = 9;

    const fmt = '"Q"#,##0';

    prestamos.forEach((p, idx) => {
      const fmtD = (d) => d ? new Date(d).toLocaleDateString('es-GT', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: '2-digit' }) : '-';
      const totCuota = p.semanas.reduce((s, w) => s + w.cuota, 0);
      const totMora = p.semanas.reduce((s, w) => s + w.mora, 0);
      const totAdmon = p.semanas.reduce((s, w) => s + w.admon, 0);

      const vals = [
        idx + 1, p.cliente_nombre, fmtD(p.fecha_inicio), fmtD(p.fecha_fin), p.principal, p.saldo,
        ...p.semanas.flatMap(w => [w.cuota || null, w.mora || null, w.admon || null]),
        totCuota || null, totMora || null, totAdmon || null
      ];
      const row = ws.addRow(vals);
      row.font = { size: 8 };
      for (let c = 5; c <= 21; c++) {
        const cell = row.getCell(c);
        if (cell.value != null) { cell.numFmt = fmt; cell.alignment = { horizontal: 'right' }; }
      }
    });

    // Totales
    if (prestamos.length > 0) {
      const totals = ['', 'TOTALES', '', '',
        prestamos.reduce((s, p) => s + p.principal, 0),
        prestamos.reduce((s, p) => s + p.saldo, 0),
      ];
      for (let si = 0; si < 4; si++) {
        totals.push(prestamos.reduce((s, p) => s + p.semanas[si].cuota, 0) || null);
        totals.push(prestamos.reduce((s, p) => s + p.semanas[si].mora, 0) || null);
        totals.push(prestamos.reduce((s, p) => s + p.semanas[si].admon, 0) || null);
      }
      totals.push(prestamos.reduce((s, p) => s + p.semanas.reduce((a, w) => a + w.cuota, 0), 0) || null);
      totals.push(prestamos.reduce((s, p) => s + p.semanas.reduce((a, w) => a + w.mora, 0), 0) || null);
      totals.push(prestamos.reduce((s, p) => s + p.semanas.reduce((a, w) => a + w.admon, 0), 0) || null);

      const totRow = ws.addRow(totals);
      totRow.font = { bold: true, size: 8 };
      totRow.eachCell({ includeEmpty: true }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F0' } };
      });
      for (let c = 5; c <= 21; c++) {
        const cell = totRow.getCell(c);
        if (cell.value != null) { cell.numFmt = fmt; cell.alignment = { horizontal: 'right' }; }
      }
    }

    const filename = `cobranza-mensual-${data.mesActual}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error en cobranza-mensual/excel:', err);
    res.status(500).json({ error: 'Error al generar Excel' });
  }
});

// ─── Mensual PDF ───
router.get('/cobranza-mensual/pdf', appAuth, requirePermission('/reportes'), async (req, res) => {
  let browser = null;
  try {
    const data = await getCobranzaMensualData(req.query);
    const agenteName = data.filtroAgente
      ? data.agentes.find(a => a.agente_id == data.filtroAgente)?.nombre || ''
      : 'Todos';

    const templatePath = path.resolve(__dirname, '../../views/reportes/cobranza-mensual-print.ejs');
    const html = await ejs.renderFile(templatePath, { ...data, agenteName });

    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'Legal',
      landscape: true,
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }
    });

    const filename = `cobranza-mensual-${data.mesActual}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error en cobranza-mensual/pdf:', err);
    res.status(500).json({ error: 'Error al generar PDF' });
  } finally {
    if (browser) await browser.close();
  }
});

// ─── Mensual HTML ───
router.get('/cobranza-mensual', appAuth, requirePermission('/reportes'), async (req, res) => {
  try {
    const data = await getCobranzaMensualData(req.query);
    res.render('reportes/cobranza-mensual', {
      title: 'Cobranza Mensual',
      pageScripts: ['/assets/js/custom/cobranza-mensual.js'],
      ...data
    });
  } catch (err) {
    console.error('Error en cobranza-mensual:', err);
    res.status(500).render('error/500', { error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESUMEN GENERAL
// ═══════════════════════════════════════════════════════════════════════════════

async function getResumenGeneralData(query) {
  let year, month;
  if (query.mes && /^\d{4}-\d{2}$/.test(query.mes)) {
    const parts = query.mes.split('-');
    year = Number(parts[0]);
    month = Number(parts[1]);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const fechaInicio = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const fechaFin = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  const mesLabel = `${nombresMes[month - 1]} ${year}`;

  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const mesAnterior = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const mesSiguiente = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
  const mesActual = `${year}-${String(month).padStart(2, '0')}`;

  // KPIs globales
  const qParams = { fechaInicio, fechaFin };

  const prestamosActivos = await dbQuery(`
    SELECT COUNT(*) AS total, ISNULL(SUM(principal), 0) AS capital
    FROM prestamos.core WHERE estado = 'ACTIVO'
  `);

  const capitalMes = await dbQuery(`
    SELECT ISNULL(SUM(principal), 0) AS total
    FROM prestamos.core WHERE fecha_inicio BETWEEN @fechaInicio AND @fechaFin
  `, qParams);

  const moraTotalR = await dbQuery(`
    SELECT ISNULL(SUM(d.mora), 0) AS total
    FROM prestamos.detalle d
    JOIN prestamos.core p ON p.prestamo_id = d.prestamo_id
    WHERE p.estado = 'ACTIVO' AND d.estado IN ('ATRASADO','MOROSO')
  `);

  const cobranzaMes = await dbQuery(`
    SELECT
      ISNULL(SUM(d.monto_pagado), 0) AS cobrado_mes,
      ISNULL(SUM(d.cuota_programada), 0) AS programado_mes,
      SUM(CASE WHEN d.estado = 'PAGADO' THEN 1 ELSE 0 END) AS cuotas_pagadas_mes,
      COUNT(*) AS cuotas_total_mes
    FROM prestamos.detalle d
    JOIN prestamos.core p ON p.prestamo_id = d.prestamo_id
    WHERE d.fecha_cuota BETWEEN @fechaInicio AND @fechaFin AND p.estado = 'ACTIVO'
  `, qParams);

  const admonR = await dbQuery(`
    SELECT
      ISNULL(SUM(CASE WHEN CAST(p.fecha_pago_cobro_admon AS DATE) BETWEEN @fechaInicio AND @fechaFin THEN p.cobro_admon ELSE 0 END), 0) AS admon_cobrado_mes,
      ISNULL(SUM(p.cobro_admon), 0) AS admon_total
    FROM prestamos.core p WHERE p.estado = 'ACTIVO'
  `, qParams);

  const cobradoHoyR = await dbQuery(`
    SELECT ISNULL(SUM(d.monto_pagado), 0) AS total
    FROM prestamos.detalle d
    JOIN prestamos.core p ON p.prestamo_id = d.prestamo_id
    WHERE CAST(d.fecha_pago AS DATE) = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central America Standard Time' AS DATE)
      AND p.estado = 'ACTIVO'
  `);

  const kpis = {
    prestamos_activos: prestamosActivos[0]?.total || 0,
    capital_total: prestamosActivos[0]?.capital || 0,
    capital_colocado_mes: capitalMes[0]?.total || 0,
    mora_total: moraTotalR[0]?.total || 0,
    cobrado_mes: cobranzaMes[0]?.cobrado_mes || 0,
    programado_mes: cobranzaMes[0]?.programado_mes || 0,
    cuotas_pagadas_mes: cobranzaMes[0]?.cuotas_pagadas_mes || 0,
    cuotas_total_mes: cobranzaMes[0]?.cuotas_total_mes || 0,
    admon_cobrado_mes: admonR[0]?.admon_cobrado_mes || 0,
    admon_total: admonR[0]?.admon_total || 0,
    cobrado_hoy: cobradoHoyR[0]?.total || 0,
    tasa_cobro_mes: cobranzaMes[0]?.cuotas_total_mes > 0
      ? Math.round((cobranzaMes[0]?.cuotas_pagadas_mes / cobranzaMes[0]?.cuotas_total_mes) * 100)
      : 0,
  };

  // Desglose por agente
  const porAgente = await dbQuery(`
    SELECT
      ISNULL(a.nombres + ' ' + ISNULL(a.apellidos, ''), 'Sin agente') AS agente_nombre,
      a.agente_id,
      COUNT(DISTINCT p.prestamo_id) AS prestamos_activos,
      ISNULL(SUM(DISTINCT p.principal), 0) AS capital,
      ISNULL(SUM(DISTINCT p.total_pagar), 0) AS total_pagar,
      ISNULL(SUM(DISTINCT p.total_pagar) - SUM(DISTINCT ISNULL(pagado.total_pagado, 0)), 0) AS saldo
    FROM prestamos.core p
    JOIN clientes.core c ON c.cui9 = p.cui9
    LEFT JOIN prestamos.agentes a ON a.agente_id = c.cartera_id
    LEFT JOIN (
      SELECT prestamo_id, SUM(monto_pagado) AS total_pagado
      FROM prestamos.detalle GROUP BY prestamo_id
    ) pagado ON pagado.prestamo_id = p.prestamo_id
    WHERE p.estado = 'ACTIVO'
    GROUP BY a.agente_id, a.nombres, a.apellidos
    ORDER BY a.nombres
  `, {});

  // Cobros por agente en el mes
  const cobrosPorAgente = await dbQuery(`
    SELECT
      c.cartera_id AS agente_id,
      ISNULL(SUM(d.monto_pagado), 0) AS cobrado_mes,
      ISNULL(SUM(d.mora), 0) AS mora_mes,
      SUM(CASE WHEN d.estado = 'PAGADO' THEN 1 ELSE 0 END) AS cuotas_pagadas
    FROM prestamos.detalle d
    JOIN prestamos.core p ON p.prestamo_id = d.prestamo_id
    JOIN clientes.core c ON c.cui9 = p.cui9
    WHERE d.fecha_cuota BETWEEN @fechaInicio AND @fechaFin
      AND p.estado = 'ACTIVO'
    GROUP BY c.cartera_id
  `, { fechaInicio, fechaFin });

  // Merge cobros into porAgente
  const cobrosMap = new Map(cobrosPorAgente.map(r => [r.agente_id, r]));
  const agentesResumen = porAgente.map(a => ({
    ...a,
    cobrado_mes: cobrosMap.get(a.agente_id)?.cobrado_mes || 0,
    mora_mes: cobrosMap.get(a.agente_id)?.mora_mes || 0,
    cuotas_pagadas: cobrosMap.get(a.agente_id)?.cuotas_pagadas || 0,
  }));

  return {
    year, month, mesLabel, mesActual, mesAnterior, mesSiguiente,
    kpis,
    agentes: agentesResumen,
  };
}

// ─── Resumen General PDF ───
router.get('/resumen-general/pdf', appAuth, requirePermission('/reportes'), async (req, res) => {
  let browser = null;
  try {
    const data = await getResumenGeneralData(req.query);
    const templatePath = path.resolve(__dirname, '../../views/reportes/resumen-general-print.ejs');
    const html = await ejs.renderFile(templatePath, data);

    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'Letter', landscape: false, printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="resumen-general-${data.mesActual}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error en resumen-general/pdf:', err);
    res.status(500).json({ error: 'Error al generar PDF' });
  } finally {
    if (browser) await browser.close();
  }
});

// ─── Resumen General HTML ───
router.get('/resumen-general', appAuth, requirePermission('/reportes'), async (req, res) => {
  try {
    const data = await getResumenGeneralData(req.query);
    res.render('reportes/resumen-general', {
      title: 'Resumen General',
      pageScripts: ['/assets/js/custom/resumen-general.js'],
      ...data
    });
  } catch (err) {
    console.error('Error en resumen-general:', err);
    res.status(500).render('error/500', { error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTE POR CARTERA / AGENTE
// ═══════════════════════════════════════════════════════════════════════════════

async function getReporteCarteraData() {
  // Préstamos activos con info completa
  const rows = await dbQuery(`
    SELECT
      p.prestamo_id,
      c.nombres + ' ' + c.apellidos AS cliente_nombre,
      c.telefono AS cliente_telefono,
      c.cartera_id,
      p.principal,
      p.cuota_diaria,
      p.total_pagar,
      p.fecha_inicio,
      p.plazo_dias,
      ISNULL(p.cobro_admon, 0) AS cobro_admon,
      p.fecha_pago_cobro_admon,
      p.estado,
      (p.total_pagar - ISNULL(pagado.total_pagado, 0)) AS saldo,
      ISNULL(pagado.total_pagado, 0) AS total_pagado,
      ISNULL(atrasos.cuotas_atrasadas, 0) AS cuotas_atrasadas,
      ISNULL(atrasos.mora_total, 0) AS mora_total,
      ISNULL(pagadas.cuotas_pagadas, 0) AS cuotas_pagadas,
      ISNULL(a.agente_id, 0) AS agente_id,
      ISNULL(a.nombres + ' ' + ISNULL(a.apellidos,''), 'Sin agente') AS agente_nombre
    FROM prestamos.core p
    JOIN clientes.core c ON c.cui9 = p.cui9
    LEFT JOIN prestamos.agentes a ON a.agente_id = c.cartera_id
    LEFT JOIN (
      SELECT prestamo_id, SUM(monto_pagado) AS total_pagado
      FROM prestamos.detalle GROUP BY prestamo_id
    ) pagado ON pagado.prestamo_id = p.prestamo_id
    LEFT JOIN (
      SELECT prestamo_id,
        SUM(CASE WHEN estado IN ('ATRASADO','MOROSO') THEN 1 ELSE 0 END) AS cuotas_atrasadas,
        SUM(CASE WHEN estado IN ('ATRASADO','MOROSO') THEN ISNULL(mora, 0) ELSE 0 END) AS mora_total
      FROM prestamos.detalle GROUP BY prestamo_id
    ) atrasos ON atrasos.prestamo_id = p.prestamo_id
    LEFT JOIN (
      SELECT prestamo_id, SUM(CASE WHEN estado = 'PAGADO' THEN 1 ELSE 0 END) AS cuotas_pagadas
      FROM prestamos.detalle GROUP BY prestamo_id
    ) pagadas ON pagadas.prestamo_id = p.prestamo_id
    WHERE p.estado = 'ACTIVO'
    ORDER BY a.nombres, c.apellidos, c.nombres
  `);

  // Agrupar por agente
  const agentesMap = new Map();
  for (const row of rows) {
    const key = row.agente_id;
    if (!agentesMap.has(key)) {
      agentesMap.set(key, {
        agente_id: row.agente_id,
        agente_nombre: row.agente_nombre,
        prestamos: [],
        totales: { prestamos: 0, capital: 0, saldo: 0, cobrado: 0, mora: 0, admon_cobrado: 0, admon_total: 0 }
      });
    }
    const ag = agentesMap.get(key);
    const progreso = row.plazo_dias > 0 ? Math.round((row.cuotas_pagadas / row.plazo_dias) * 100) : 0;

    ag.prestamos.push({
      ...row,
      progreso,
      cobro_admon_pagado: !!row.fecha_pago_cobro_admon,
    });

    ag.totales.prestamos++;
    ag.totales.capital += row.principal;
    ag.totales.saldo += row.saldo;
    ag.totales.cobrado += row.total_pagado;
    ag.totales.mora += row.mora_total;
    ag.totales.admon_total += row.cobro_admon;
    if (row.fecha_pago_cobro_admon) ag.totales.admon_cobrado += row.cobro_admon;
  }

  const agentes = Array.from(agentesMap.values());

  // Totales globales
  const globalTotales = {
    prestamos: rows.length,
    capital: agentes.reduce((s, a) => s + a.totales.capital, 0),
    saldo: agentes.reduce((s, a) => s + a.totales.saldo, 0),
    cobrado: agentes.reduce((s, a) => s + a.totales.cobrado, 0),
    mora: agentes.reduce((s, a) => s + a.totales.mora, 0),
    admon_cobrado: agentes.reduce((s, a) => s + a.totales.admon_cobrado, 0),
    admon_total: agentes.reduce((s, a) => s + a.totales.admon_total, 0),
  };

  return { agentes, globalTotales };
}

// ─── Cartera PDF ───
router.get('/reporte-cartera/pdf', appAuth, requirePermission('/reportes'), async (req, res) => {
  let browser = null;
  try {
    const data = await getReporteCarteraData();
    const templatePath = path.resolve(__dirname, '../../views/reportes/reporte-cartera-print.ejs');
    const html = await ejs.renderFile(templatePath, data);

    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'Legal', landscape: true, printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="reporte-cartera.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error en reporte-cartera/pdf:', err);
    res.status(500).json({ error: 'Error al generar PDF' });
  } finally {
    if (browser) await browser.close();
  }
});

// ─── Cartera HTML ───
router.get('/reporte-cartera', appAuth, requirePermission('/reportes'), async (req, res) => {
  try {
    const data = await getReporteCarteraData();
    res.render('reportes/reporte-cartera', {
      title: 'Reporte por Cartera',
      ...data
    });
  } catch (err) {
    console.error('Error en reporte-cartera:', err);
    res.status(500).render('error/500', { error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTE DE MOROSIDAD
// ═══════════════════════════════════════════════════════════════════════════════

async function getReporteMorosidadData(query) {
  let year, month;
  if (query.mes && /^\d{4}-\d{2}$/.test(query.mes)) {
    const parts = query.mes.split('-');
    year = Number(parts[0]);
    month = Number(parts[1]);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const fechaInicio = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const fechaFin = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  const mesLabel = `${nombresMes[month - 1]} ${year}`;
  const mesActual = `${year}-${String(month).padStart(2, '0')}`;

  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const mesAnterior = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const mesSiguiente = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

  const filtroAgenteId = query.agente ? Number(query.agente) : null;
  const whereAgente = filtroAgenteId ? 'AND c.cartera_id = @agenteId' : '';
  const qParams = { fechaInicio, fechaFin };
  if (filtroAgenteId) qParams.agenteId = filtroAgenteId;

  // Préstamos con cuotas atrasadas en el mes
  const rows = await dbQuery(`
    SELECT
      p.prestamo_id,
      c.nombres + ' ' + c.apellidos AS cliente_nombre,
      c.telefono AS cliente_telefono,
      c.direccion AS cliente_direccion,
      c.cartera_id,
      ISNULL(a.nombres + ' ' + ISNULL(a.apellidos,''), 'Sin agente') AS agente_nombre,
      p.principal,
      p.cuota_diaria,
      p.total_pagar,
      p.fecha_inicio,
      p.plazo_dias,
      (p.total_pagar - ISNULL(pagado.total_pagado, 0)) AS saldo,
      mora.cuotas_atrasadas,
      mora.dias_mora_max,
      mora.monto_mora,
      mora.monto_cuotas_atrasadas
    FROM prestamos.core p
    JOIN clientes.core c ON c.cui9 = p.cui9
    LEFT JOIN prestamos.agentes a ON a.agente_id = c.cartera_id
    LEFT JOIN (
      SELECT prestamo_id, SUM(monto_pagado) AS total_pagado
      FROM prestamos.detalle GROUP BY prestamo_id
    ) pagado ON pagado.prestamo_id = p.prestamo_id
    INNER JOIN (
      SELECT
        prestamo_id,
        COUNT(*) AS cuotas_atrasadas,
        DATEDIFF(DAY, MIN(fecha_cuota), CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central America Standard Time' AS DATE)) AS dias_mora_max,
        SUM(ISNULL(mora, 0)) AS monto_mora,
        SUM(cuota_programada) AS monto_cuotas_atrasadas
      FROM prestamos.detalle
      WHERE estado IN ('ATRASADO', 'MOROSO')
        AND fecha_cuota BETWEEN @fechaInicio AND @fechaFin
      GROUP BY prestamo_id
    ) mora ON mora.prestamo_id = p.prestamo_id
    WHERE p.estado = 'ACTIVO'
    ${whereAgente}
    ORDER BY mora.dias_mora_max DESC, mora.cuotas_atrasadas DESC
  `, qParams);

  // KPIs
  const totalMorosos = rows.length;
  const totalCuotasAtrasadas = rows.reduce((s, r) => s + r.cuotas_atrasadas, 0);
  const totalMontoMora = rows.reduce((s, r) => s + r.monto_mora, 0);
  const totalMontoCuotasAtrasadas = rows.reduce((s, r) => s + r.monto_cuotas_atrasadas, 0);
  const totalPendiente = totalMontoCuotasAtrasadas + totalMontoMora;

  // Total prestamos activos para calcular tasa
  const totalActivos = await dbQuery(`
    SELECT COUNT(*) AS total FROM prestamos.core WHERE estado = 'ACTIVO'
  `);
  const tasaMorosidad = totalActivos[0]?.total > 0
    ? Math.round((totalMorosos / totalActivos[0].total) * 100)
    : 0;

  // Agentes para filtro
  const agentes = await dbQuery(`
    SELECT agente_id, codigo, nombres + ' ' + ISNULL(apellidos,'') AS nombre
    FROM prestamos.agentes WHERE _estado = 'AC' ORDER BY nombres
  `);

  return {
    year, month, mesLabel, mesActual, mesAnterior, mesSiguiente,
    prestamos: rows,
    agentes,
    filtroAgente: query.agente || '',
    kpis: {
      totalMorosos,
      totalCuotasAtrasadas,
      totalMontoMora,
      totalMontoCuotasAtrasadas,
      totalPendiente,
      tasaMorosidad,
      totalActivos: totalActivos[0]?.total || 0,
    }
  };
}

// ─── Morosidad PDF ───
router.get('/reporte-morosidad/pdf', appAuth, requirePermission('/reportes'), async (req, res) => {
  let browser = null;
  try {
    const data = await getReporteMorosidadData(req.query);
    const agenteName = data.filtroAgente
      ? data.agentes.find(a => a.agente_id == data.filtroAgente)?.nombre || ''
      : 'Todos';
    const templatePath = path.resolve(__dirname, '../../views/reportes/reporte-morosidad-print.ejs');
    const html = await ejs.renderFile(templatePath, { ...data, agenteName });

    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'Legal', landscape: true, printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="reporte-morosidad-${data.mesActual}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error en reporte-morosidad/pdf:', err);
    res.status(500).json({ error: 'Error al generar PDF' });
  } finally {
    if (browser) await browser.close();
  }
});

// ─── Morosidad HTML ───
router.get('/reporte-morosidad', appAuth, requirePermission('/reportes'), async (req, res) => {
  try {
    const data = await getReporteMorosidadData(req.query);
    res.render('reportes/reporte-morosidad', {
      title: 'Reporte de Morosidad',
      pageScripts: ['/assets/js/custom/reporte-morosidad.js'],
      ...data
    });
  } catch (err) {
    console.error('Error en reporte-morosidad:', err);
    res.status(500).render('error/500', { error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTE DE PAGOS DIARIOS
// ═══════════════════════════════════════════════════════════════════════════════

async function getReportePagosDiariosData(query) {
  let year, month;
  if (query.mes && /^\d{4}-\d{2}$/.test(query.mes)) {
    const parts = query.mes.split('-');
    year = Number(parts[0]);
    month = Number(parts[1]);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const fechaInicio = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const fechaFin = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  const mesLabel = `${nombresMes[month - 1]} ${year}`;
  const mesActual = `${year}-${String(month).padStart(2, '0')}`;

  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const mesAnterior = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const mesSiguiente = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

  const filtroAgenteId = query.agente ? Number(query.agente) : null;
  const whereAgente = filtroAgenteId ? 'AND c.cartera_id = @agenteId' : '';
  const qParams = { fechaInicio, fechaFin };
  if (filtroAgenteId) qParams.agenteId = filtroAgenteId;

  // Pagos individuales del mes
  const pagos = await dbQuery(`
    SELECT
      d.detalle_id,
      d.prestamo_id,
      d.dia_num,
      d.fecha_cuota,
      d.cuota_programada,
      d.monto_pagado,
      d.mora,
      d.fecha_pago,
      d._usuariocreo AS usuario_pago,
      c.nombres + ' ' + c.apellidos AS cliente_nombre,
      c.telefono AS cliente_telefono,
      c.cartera_id,
      ISNULL(a.nombres + ' ' + ISNULL(a.apellidos,''), 'Sin agente') AS agente_nombre
    FROM prestamos.detalle d
    JOIN prestamos.core p ON p.prestamo_id = d.prestamo_id
    JOIN clientes.core c ON c.cui9 = p.cui9
    LEFT JOIN prestamos.agentes a ON a.agente_id = c.cartera_id
    WHERE d.estado = 'PAGADO'
      AND CAST(d.fecha_pago AS DATE) BETWEEN @fechaInicio AND @fechaFin
      ${whereAgente}
    ORDER BY d.fecha_pago DESC
  `, qParams);

  // Cobros administrativos del mes
  const cobrosAdmon = await dbQuery(`
    SELECT
      p.prestamo_id,
      p.cobro_admon,
      p.fecha_pago_cobro_admon,
      c.nombres + ' ' + c.apellidos AS cliente_nombre,
      ISNULL(a.nombres + ' ' + ISNULL(a.apellidos,''), 'Sin agente') AS agente_nombre
    FROM prestamos.core p
    JOIN clientes.core c ON c.cui9 = p.cui9
    LEFT JOIN prestamos.agentes a ON a.agente_id = c.cartera_id
    WHERE CAST(p.fecha_pago_cobro_admon AS DATE) BETWEEN @fechaInicio AND @fechaFin
      ${whereAgente}
    ORDER BY p.fecha_pago_cobro_admon DESC
  `, qParams);

  // Resumen por día
  const resumenMap = new Map();
  for (const pago of pagos) {
    const diaKey = new Date(pago.fecha_pago).toLocaleDateString('en-CA', { timeZone: 'UTC' });
    if (!resumenMap.has(diaKey)) {
      resumenMap.set(diaKey, {
        fecha: diaKey,
        cantidadPagos: 0,
        totalCuotas: 0,
        totalMora: 0,
        totalAdmon: 0,
      });
    }
    const r = resumenMap.get(diaKey);
    r.cantidadPagos++;
    r.totalCuotas += (pago.monto_pagado || 0);
    r.totalMora += (pago.mora || 0);
  }

  // Agregar cobros admon al resumen
  for (const ca of cobrosAdmon) {
    const diaKey = new Date(ca.fecha_pago_cobro_admon).toLocaleDateString('en-CA', { timeZone: 'UTC' });
    if (!resumenMap.has(diaKey)) {
      resumenMap.set(diaKey, { fecha: diaKey, cantidadPagos: 0, totalCuotas: 0, totalMora: 0, totalAdmon: 0 });
    }
    resumenMap.get(diaKey).totalAdmon += (ca.cobro_admon || 0);
  }

  const resumenDiario = Array.from(resumenMap.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
  resumenDiario.forEach(d => { d.totalDia = d.totalCuotas + d.totalMora + d.totalAdmon; });

  // KPIs
  const totalCuotas = pagos.reduce((s, p) => s + (p.monto_pagado || 0), 0);
  const totalMora = pagos.reduce((s, p) => s + (p.mora || 0), 0);
  const totalAdmon = cobrosAdmon.reduce((s, c) => s + (c.cobro_admon || 0), 0);

  const agentes = await dbQuery(`
    SELECT agente_id, codigo, nombres + ' ' + ISNULL(apellidos,'') AS nombre
    FROM prestamos.agentes WHERE _estado = 'AC' ORDER BY nombres
  `);

  return {
    year, month, mesLabel, mesActual, mesAnterior, mesSiguiente,
    pagos,
    cobrosAdmon,
    resumenDiario,
    agentes,
    filtroAgente: query.agente || '',
    kpis: {
      totalPagos: pagos.length,
      totalCuotas,
      totalMora,
      totalAdmon,
      totalGeneral: totalCuotas + totalMora + totalAdmon,
      diasConPagos: resumenDiario.length,
    }
  };
}

// ─── Pagos Diarios PDF ───
router.get('/reporte-pagos-diarios/pdf', appAuth, requirePermission('/reportes'), async (req, res) => {
  let browser = null;
  try {
    const data = await getReportePagosDiariosData(req.query);
    const agenteName = data.filtroAgente
      ? data.agentes.find(a => a.agente_id == data.filtroAgente)?.nombre || ''
      : 'Todos';
    const templatePath = path.resolve(__dirname, '../../views/reportes/reporte-pagos-diarios-print.ejs');
    const html = await ejs.renderFile(templatePath, { ...data, agenteName });

    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'Legal', landscape: true, printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="pagos-diarios-${data.mesActual}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error en reporte-pagos-diarios/pdf:', err);
    res.status(500).json({ error: 'Error al generar PDF' });
  } finally {
    if (browser) await browser.close();
  }
});

// ─── Pagos Diarios HTML ───
router.get('/reporte-pagos-diarios', appAuth, requirePermission('/reportes'), async (req, res) => {
  try {
    const data = await getReportePagosDiariosData(req.query);
    res.render('reportes/reporte-pagos-diarios', {
      title: 'Pagos Diarios',
      pageScripts: ['/assets/js/custom/reporte-pagos-diarios.js'],
      ...data
    });
  } catch (err) {
    console.error('Error en reporte-pagos-diarios:', err);
    res.status(500).render('error/500', { error: err.message });
  }
});

export default router;
