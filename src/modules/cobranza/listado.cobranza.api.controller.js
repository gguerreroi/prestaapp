import { connection, mssql } from "../../config/db.js";
import getInfo from "../../middlewares/auth/getInfo.js";

const VIEW_NAME = "ui.vw_datatables_prestamos_listado";

// Columnas permitidas para ordenamiento (whitelist)
const VALID_ORDER_COLS = [
	"prestamo_id", "cliente_nombres", "cliente_apellidos", "agente_nombre",
	"cuota_diaria", "saldo", "cuotas_pagadas", "cuotas_atrasadas", "estado",
	"fecha_inicio", "principal", "total_pagar", "plazo_dias"
];

// Columnas usadas en búsqueda
const SEARCH_COLS = [
	"prestamo_id", "cliente_nombres", "cliente_apellidos", "cliente_telefono",
	"cui9", "agente_nombre", "estado"
];

export async function listadoCobranza(req, res) {
	try {
		const pool = await connection();
		if (pool?.code) {
			return res.status(502).json({ code: "DB_CONN", message: pool.message, data: [] });
		}

		const info = getInfo(req);
		const agentesStr = info?.user?.Agentes || "";
		const agentesArr = agentesStr.split(",").map(s => Number(s.trim())).filter(Boolean);

		if (agentesArr.length === 0) {
			return res.json({ draw: 0, recordsTotal: 0, recordsFiltered: 0, data: [] });
		}

		// DataTables params
		const draw = Number(req.query.draw || 0);
		const start = Math.max(0, Number(req.query.start || 0));
		const length = Math.max(10, Math.min(500, Number(req.query.length || 10)));

		const searchValue = (
			req.query?.search?.value ??
			req.query?.["search[value]"] ??
			""
		).toString().trim();

		const estadoFilter = (req.query?.estado || "").toString().trim().toUpperCase();

		const orderColIndex = Number(
			req.query?.order?.[0]?.column ??
			req.query?.["order[0][column]"] ??
			0
		);

		const orderDirRaw = (
			req.query?.order?.[0]?.dir ??
			req.query?.["order[0][dir]"] ??
			"asc"
		).toString().toLowerCase();

		const requestedOrderCol = (
			req.query?.columns?.[orderColIndex]?.name ??
			req.query?.columns?.[orderColIndex]?.data ??
			req.query?.[`columns[${orderColIndex}][name]`] ??
			req.query?.[`columns[${orderColIndex}][data]`] ??
			""
		).toString().trim();

		const orderDir = orderDirRaw === "desc" ? "DESC" : "ASC";
		const orderColumnSafe = VALID_ORDER_COLS.includes(requestedOrderCol) ? requestedOrderCol : "prestamo_id";

		// Build WHERE clauses
		const whereParts = [];

		// Filtro por agentes del usuario (seguro con IN y parámetros numerados)
		const agentePlaceholders = agentesArr.map((_, i) => `@ag${i}`).join(",");
		whereParts.push(`agente_id IN (${agentePlaceholders})`);

		// Filtro por estado
		if (estadoFilter && ["ACTIVO", "PAGADO", "ANULADO"].includes(estadoFilter)) {
			whereParts.push("estado = @estado");
		}

		// Búsqueda global
		if (searchValue) {
			const searchExpr = SEARCH_COLS.map(c => `TRY_CONVERT(NVARCHAR(4000), ${c})`).join(",");
			whereParts.push(`CONCAT_WS(' ', ${searchExpr}) LIKE @q`);
		}

		const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

		// Base WHERE for total count (only agent filter)
		const whereTotalParts = [`agente_id IN (${agentePlaceholders})`];
		const whereTotalClause = `WHERE ${whereTotalParts.join(" AND ")}`;

		// SQL queries
		const sqlTotal = `SELECT COUNT(1) AS total FROM ${VIEW_NAME} ${whereTotalClause};`;
		const sqlFiltered = `SELECT COUNT(1) AS total FROM ${VIEW_NAME} ${whereClause};`;
		const sqlData = `
			SELECT *
			FROM ${VIEW_NAME}
			${whereClause}
			ORDER BY ${orderColumnSafe} ${orderDir}
			OFFSET @start ROWS FETCH NEXT @length ROWS ONLY;
		`;

		// Execute
		const reqDb = pool.request();
		reqDb.input("start", mssql.Int, start);
		reqDb.input("length", mssql.Int, length);
		reqDb.input("q", mssql.NVarChar(500), `%${searchValue}%`);

		if (estadoFilter && ["ACTIVO", "PAGADO", "ANULADO"].includes(estadoFilter)) {
			reqDb.input("estado", mssql.NVarChar(20), estadoFilter);
		}

		// Agentes como parámetros individuales
		agentesArr.forEach((id, i) => {
			reqDb.input(`ag${i}`, mssql.Int, id);
		});

		const totalRs = await reqDb.query(sqlTotal);
		const recordsTotal = Number(totalRs?.recordset?.[0]?.total || 0);

		const filteredRs = await reqDb.query(sqlFiltered);
		const recordsFiltered = Number(filteredRs?.recordset?.[0]?.total || 0);

		const dataRs = await reqDb.query(sqlData);

		return res.json({
			draw,
			recordsTotal,
			recordsFiltered,
			data: dataRs?.recordset || []
		});

	} catch (err) {
		console.error("cobranza listado error:", err);
		return res.status(500).json({
			code: "SERVER_ERROR",
			message: err?.message || "Error consultando cobranza",
			data: []
		});
	}
}
