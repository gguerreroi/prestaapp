import { connection, mssql } from "../../config/db.js";

export async function datatables(req, res) {
	const { view } = req.params;

	// ✅ Validación mínima del nombre de vista: solo letras, números y guion bajo
	// (evita puntos, espacios, comillas, etc.)
	if (!/^[a-zA-Z0-9_]+$/.test(view)) {
		return res.status(400).json({ code: "VALIDATION", message: "view inválida", data: [] });
	}

	const viewName = `ui.vw_datatables_${view}`; // <- convención

	try {
		const pool = await connection();
		if (pool?.code) {
			return res.status(502).json({ code: "DB_CONN", message: pool.message, data: [] });
		}

		const draw = Number(req.query.draw || 0);
		const start = Math.max(0, Number(req.query.start || 0));
		const length = Math.max(10, Math.min(500, Number(req.query.length || 10)));

		const searchValue = (
			req.query?.search?.value ??
			req.query?.["search[value]"] ??
			""
		).toString().trim();

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

		// ===== 1) Verificar que la vista exista y obtener columnas válidas =====
		// Importante: OBJECT_ID('schema.view') funciona con vistas
		const metaReq = pool.request();
		metaReq.input("obj", mssql.NVarChar(256), viewName);

		const meta = await metaReq.query(`
      SELECT c.name AS col
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID(@obj)
      ORDER BY c.column_id;
    `);

		const cols = (meta.recordset || []).map(r => r.col);

		if (cols.length === 0) {
			return res.status(404).json({
				code: "NOT_FOUND",
				message: `Vista no existe o no accesible: ${viewName}`,
				data: []
			});
		}

		// ✅ Order column seguro (debe existir en la vista)
		const orderColumnSafe = cols.includes(requestedOrderCol) ? requestedOrderCol : cols[0];

		// ===== 2) Filtros exactos (estado, atrasos, agente_id, etc.) =====
		// Patrón seguro: solo se agregan WHERE si la columna existe en la vista
		const whereParts = [];
		const filterInputs = []; // { name, type, value }

		// Filtros permitidos: { queryParam: { column, type, compare } }
		const allowedFilters = {
			estado:          { column: "estado",           type: mssql.NVarChar(50),  compare: "=" },
			cliente__estado: { column: "cliente__estado",   type: mssql.NVarChar(10),  compare: "=" },
			atrasos:         { column: "cuotas_atrasadas", type: mssql.Int,           compare: "special_atrasos" },
			agente_id:       { column: "agente_id",        type: mssql.Int,           compare: "=" },
		};

		for (const [param, cfg] of Object.entries(allowedFilters)) {
			const val = (req.query[param] ?? "").toString().trim();
			if (!val || !cols.includes(cfg.column)) continue;

			const paramName = `flt_${param}`;
			if (cfg.compare === "=") {
				whereParts.push(`[${cfg.column}] = @${paramName}`);
				filterInputs.push({ name: paramName, type: cfg.type, value: val });
			} else if (cfg.compare === "special_atrasos") {
				// atrasos=1 -> cuotas_atrasadas > 0, atrasos=0 -> cuotas_atrasadas = 0
				if (val === "1") {
					whereParts.push(`[${cfg.column}] > 0`);
				} else if (val === "0") {
					whereParts.push(`[${cfg.column}] = 0`);
				}
			}
		}

		// ===== 3) Búsqueda global (search sobre todas las columnas "text-like") =====
		if (searchValue) {
			whereParts.push(`CONCAT_WS(' ', ${cols.map(c => `TRY_CONVERT(NVARCHAR(4000), [${c}])`).join(",")}) LIKE @q`);
		}

		const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

		// ===== 4) Queries =====
		const sqlTotal = `SELECT COUNT(1) AS total FROM ${viewName};`;
		const sqlFiltered = `
      SELECT COUNT(1) AS total
      FROM ${viewName}
      ${whereClause};
    `;

		const sqlData = `
      SELECT *
      FROM ${viewName}
      ${whereClause}
      ORDER BY ${orderColumnSafe} ${orderDir}
      OFFSET @start ROWS FETCH NEXT @length ROWS ONLY;
    `;

		const reqDb = pool.request();
		reqDb.input("start", mssql.Int, start);
		reqDb.input("length", mssql.Int, length);
		reqDb.input("q", mssql.NVarChar(500), `%${searchValue}%`);

		// Agregar parámetros de filtros
		for (const fi of filterInputs) {
			reqDb.input(fi.name, fi.type, fi.value);
		}

		const totalRs = await reqDb.query(sqlTotal);
		const recordsTotal = Number(totalRs?.recordset?.[0]?.total || 0);

		const filteredRs = await reqDb.query(sqlFiltered);
		const recordsFiltered = Number(filteredRs?.recordset?.[0]?.total || 0);

		const dataRs = await reqDb.query(sqlData);

		return res.status(200).json({
			draw,
			recordsTotal,
			recordsFiltered,
			data: dataRs?.recordset || []
		});

	} catch (err) {
		console.error("datatables error:", err);
		return res.status(500).json({
			code: "SERVER_ERROR",
			message: err?.message || "Error consultando DataTables",
			data: []
		});
	}
}