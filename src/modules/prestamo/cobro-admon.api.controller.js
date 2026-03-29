import { connection, mssql } from "../../config/db.js";

export async function cobrarAdmon(req, res) {
	try {
		const prestamo_id = Number(req.params.id);
		if (!prestamo_id || !Number.isFinite(prestamo_id)) {
			return res.status(400).json({ code: "VALIDATION", message: "prestamo_id invalido" });
		}

		const pool = await connection();
		if (pool?.code) {
			return res.status(502).json({ code: "DB_CONN_ERROR", message: pool.message });
		}

		// Verificar que el préstamo exista y no tenga cobro ya registrado
		const check = await pool.request()
			.input("prestamo_id", mssql.BigInt, prestamo_id)
			.query(`
				SELECT prestamo_id, cobro_admon, fecha_pago_cobro_admon
				FROM prestamos.core
				WHERE prestamo_id = @prestamo_id
			`);

		if (!check.recordset.length) {
			return res.status(404).json({ code: "NOT_FOUND", message: "Prestamo no encontrado" });
		}

		const prestamo = check.recordset[0];

		if (prestamo.fecha_pago_cobro_admon) {
			return res.status(400).json({ code: "ALREADY_PAID", message: "El cobro administrativo ya fue registrado" });
		}

		if (!prestamo.cobro_admon || prestamo.cobro_admon <= 0) {
			return res.status(400).json({ code: "NO_FEE", message: "Este prestamo no tiene cobro administrativo" });
		}

		// Registrar el pago
		await pool.request()
			.input("prestamo_id", mssql.BigInt, prestamo_id)
			.query(`
				UPDATE prestamos.core
				SET fecha_pago_cobro_admon = SYSDATETIMEOFFSET() AT TIME ZONE 'Central America Standard Time'
				WHERE prestamo_id = @prestamo_id
			`);

		return res.json({
			code: "OK",
			message: "Cobro administrativo registrado",
			data: { prestamo_id, cobro_admon: prestamo.cobro_admon }
		});

	} catch (err) {
		console.error("cobro-admon error:", err);
		return res.status(500).json({ code: "SERVER_ERROR", message: err?.message });
	}
}
