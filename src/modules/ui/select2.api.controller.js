import { connection, mssql } from "../../config/db.js";

function clampInt(n, min, max, def) {
	const v = Number(n);
	if (!Number.isFinite(v)) return def;
	return Math.max(min, Math.min(max, Math.trunc(v)));
}

// Solo letras, números y underscore. (sin puntos, sin corchetes, sin espacios)
function isSafeViewName(view) {
	return /^[a-zA-Z0-9_]{1,64}$/.test(view);
}

export async function select2(req, res) {
	try {
		const pool = await connection();
		if (pool?.code) {
			return res.status(502).json({ code: "DB_CONN_ERROR", message: pool.message, data: [] });
		}

		const view = String(req.params.view || "").trim();

		if (!isSafeViewName(view)) {
			return res.status(400).json({
				code: "VALIDATION_ERROR",
				message: "Parámetro view inválido.",
				data: [],
			});
		}

		// Armamos el nombre real de la vista: ui.vw_select2_<view>
		const viewName = `vw_select2_${view}`;

		// Paginación
		const take = clampInt(req.query.take, 1, 50, 20);
		const page = clampInt(req.query.page, 1, 1000000, 1);
		const offset = (page - 1) * take;

		// Búsqueda
		const q = String(req.query.q || "").trim();
		const like = q ? `%${q}%` : `%`;

		// 1) Verificar que la vista exista dentro del esquema ui
		const exists = await pool.request()
			.input("schema", mssql.NVarChar(128), "ui")
			.input("name", mssql.NVarChar(128), viewName)
			.query(`
        SELECT 1 AS ok
        FROM sys.views v
        INNER JOIN sys.schemas s ON s.schema_id = v.schema_id
        WHERE s.name = @schema AND v.name = @name
      `);

		if (!exists.recordset?.length) {
			return res.status(404).json({
				code: "NOT_FOUND",
				message: `Vista ui.${viewName} no existe.`,
				data: [],
			});
		}

		// 2) Query seguro:
		//    - No concatenamos el parámetro directamente como SQL libre
		//    - Usamos QUOTENAME para proteger el identificador final
		//    - like/offset/take se parametrizan
		const sql = `
      DECLARE @view SYSNAME = QUOTENAME(@schema) + '.' + QUOTENAME(@name);

      DECLARE @q NVARCHAR(200) = @like;
      DECLARE @offset INT = @p_offset;
      DECLARE @take INT = @p_take;

      DECLARE @sql NVARCHAR(MAX) =
        N'SELECT id, text
          FROM ' + @view + N'
          WHERE text LIKE @q
          ORDER BY text
          OFFSET @offset ROWS FETCH NEXT @take ROWS ONLY;

          SELECT COUNT(1) AS total
          FROM ' + @view + N'
          WHERE text LIKE @q;';

      EXEC sp_executesql
        @sql,
        N'@q NVARCHAR(200), @offset INT, @take INT',
        @q=@q, @offset=@offset, @take=@take;
    `;

		const result = await pool.request()
			.input("schema", mssql.NVarChar(128), "ui")
			.input("name", mssql.NVarChar(128), viewName)
			.input("like", mssql.NVarChar(200), like)
			.input("p_offset", mssql.Int, offset)
			.input("p_take", mssql.Int, take)
			.query(sql);

		// result.recordsets[0] => rows
		// result.recordsets[1] => count
		const rows = result.recordsets?.[0] || [];
		const total = result.recordsets?.[1]?.[0]?.total ?? 0;

		// Formato compatible Select2 (si lo quiere estándar)
		return res.status(200).json({
			code: "OK",
			message: "Consulta realizada.",
			data: {
				results: rows, // [{id, text}]
				pagination: { more: offset + rows.length < total },
				meta: { page, take, total }
			},
		});
	} catch (err) {
		console.error("ui/select2 error:", err);
		return res.status(500).json({
			code: "SERVER_ERROR",
			message: err?.message || "Error en select2",
			data: [],
		});
	}
}