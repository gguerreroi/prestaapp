import { connection, mssql } from "../../config/db.js";

function normalizeDigits(input) {
	return String(input || "")
		.replace(/[\s_\-]/g, "")
		.replace(/\D/g, "");
}

export async function getCustomerByCui9(req, res) {
	try {
		const pool = await connection();
		if (pool?.code) {
			return res.status(502).json({
				code: "DB_CONN_ERROR",
				message: pool.message,
				data: [],
			});
		}

		// Puede venir como :cui9 o :cui (13 dígitos)
		const raw = req.params.cui9 ?? req.params.cui ?? "";
		const digits = normalizeDigits(raw);

		const cui9 = digits.length >= 9 ? digits.slice(0, 9) : digits;

		if (!cui9 || cui9.length !== 9) {
			return res.status(400).json({
				code: "VALIDATION_ERROR",
				message: "cui9 inválido: deben ser exactamente 9 dígitos.",
				data: [],
			});
		}

		const result = await pool
			.request()
			.input("cui9", mssql.Char(9), cui9)
			.query(`
        SELECT
          cui9,
          cui4,
          nombres,
          apellidos,
          direccion,
          telefono,
          cartera_id,
          observaciones,
          referencias_vivienda,
          img_cui_frontal_url,
          img_cui_dorsal_url,
          img_vivienda_url,
          img_persona_url,
          _estado,
          _creado,
          _modificado
        FROM clientes.core
        WHERE cui9 = @cui9
      `);

		if (!result.recordset || result.recordset.length === 0) {
			return res.status(404).json({
				code: "NOT_FOUND",
				message: "Cliente no encontrado.",
				data: [],
			});
		}

		// Agregar campo útil para frontend (sin romper estructura)
		const data = result.recordset.map(row => ({
			...row,
			nombre_completo: `${row.nombres || ""} ${row.apellidos || ""}`.trim(),
		}));

		return res.status(200).json({
			code: "OK",
			message: "Cliente encontrado.",
			data,
		});
	} catch (err) {
		console.error("getCustomerByCui9 error:", err);

		return res.status(500).json({
			code: "SERVER_ERROR",
			message: err?.message || "Error consultando cliente",
			data: [],
		});
	}
}