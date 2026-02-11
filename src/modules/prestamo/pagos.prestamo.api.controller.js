import { connection, mssql } from "../../config/db";
import getInfo from "../../middlewares/auth/getInfo";

export async function registrarPago(req, res) {
	const { id } = req.params;

	try {
		const pool = await connection();
		if (pool?.code) {
			return res.status(502).json({ code: "DB_CONN", message: pool.message, data: [] });
		}

		const info = getInfo(req);
		const usuario =
			info?.user?.strusuario ||
			info?.user?.codusuario ||
			req?.user?.strusuario ||
			req?.user?.codusuario ||
			null;

		const ip = info?.ip || req.ip || null;

		const { cuotas } = req.body;

		// ===== Validaciones =====
		if (!id || Number.isNaN(Number(id))) {
			return res.status(400).json({ code: "VALIDATION", message: "id (prestamo_id) es obligatorio", data: [] });
		}

		if (!Array.isArray(cuotas) || cuotas.length === 0) {
			return res.status(400).json({ code: "VALIDATION", message: "Debe seleccionar al menos una cuota", data: [] });
		}

		if (!usuario) {
			return res.status(401).json({ code: "AUTH", message: "Usuario no identificado", data: [] });
		}

		// Normalizar cuotas (enteros, únicos, ordenados)
		const cuotasNorm = [...new Set(
			cuotas.map(Number).filter(n => Number.isInteger(n) && n > 0)
		)].sort((a, b) => a - b);

		if (cuotasNorm.length === 0) {
			return res.status(400).json({ code: "VALIDATION", message: "Cuotas inválidas", data: [] });
		}

		const cuotasCsv = cuotasNorm.join(",");

		// ===== Ejecutar SP =====
		const request = pool.request();
		request.input("prestamo_id", mssql.BigInt, Number(id));
		request.input("cuotas_csv", mssql.VarChar(mssql.MAX), cuotasCsv);
		request.input("usuario_modifico", mssql.NVarChar(100), String(usuario));
		request.input("ip", mssql.VarChar(45), ip ? String(ip) : null);

		const result = await request.execute("prestamos.sp_registrar_pago");

		// El SP hace un SELECT final con prestamo_id, cuotas_pagadas, procesado_utc
		const data = result?.recordset || [];

		return res.status(200).json({
			code: "OK",
			message: "Pago registrado correctamente",
			data
		});

	} catch (err) {
		console.error("registrarPago error:", err);

		// Si el SP hace THROW/RAISERROR, normalmente viene en err.message
		// Puede mapear algunos mensajes a 400 si quiere:
		const msg = err?.message || "Error al registrar pago";

		// Heurística: si es validación del SP, devuélvalo 400
		const isValidation =
			msg.toLowerCase().includes("inválid") ||
			msg.toLowerCase().includes("obligatorio") ||
			msg.toLowerCase().includes("no se actualizó") ||
			msg.toLowerCase().includes("cuotas");

		return res.status(isValidation ? 400 : 500).json({
			code: "SP_ERROR",
			message: msg,
			data: []
		});
	}
}