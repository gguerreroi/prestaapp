import { connection, mssql } from "../../config/db.js";

export async function listarCobros(req, res) {
	try {
		const pool = await connection();
		if (pool?.code) return res.status(502).json({ code: "DB_CONN_ERROR", message: pool.message });

		const result = await pool.request().query(`
			SELECT Id, monto_minimo, monto_maximo, cobro_admon
			FROM prestamos.cobros_administrativos
			ORDER BY monto_minimo
		`);

		return res.json({ code: "OK", data: result.recordset });
	} catch (err) {
		console.error("cobros-admon/listar:", err);
		return res.status(500).json({ code: "SERVER_ERROR", message: err?.message });
	}
}

export async function crearCobro(req, res) {
	try {
		const { monto_minimo, monto_maximo, cobro_admon } = req.body;

		if (monto_minimo == null || monto_maximo == null || cobro_admon == null) {
			return res.status(400).json({ code: "VALIDATION", message: "Todos los campos son requeridos" });
		}

		const pool = await connection();
		if (pool?.code) return res.status(502).json({ code: "DB_CONN_ERROR", message: pool.message });

		await pool.request()
			.input("monto_minimo", mssql.Int, Number(monto_minimo))
			.input("monto_maximo", mssql.Int, Number(monto_maximo))
			.input("cobro_admon", mssql.Int, Number(cobro_admon))
			.query(`
				INSERT INTO prestamos.cobros_administrativos (monto_minimo, monto_maximo, cobro_admon)
				VALUES (@monto_minimo, @monto_maximo, @cobro_admon)
			`);

		return res.json({ code: "OK", message: "Cobro administrativo creado" });
	} catch (err) {
		console.error("cobros-admon/crear:", err);
		return res.status(500).json({ code: "SERVER_ERROR", message: err?.message });
	}
}

export async function editarCobro(req, res) {
	try {
		const { id } = req.params;
		const { monto_minimo, monto_maximo, cobro_admon } = req.body;

		if (monto_minimo == null || monto_maximo == null || cobro_admon == null) {
			return res.status(400).json({ code: "VALIDATION", message: "Todos los campos son requeridos" });
		}

		const pool = await connection();
		if (pool?.code) return res.status(502).json({ code: "DB_CONN_ERROR", message: pool.message });

		const result = await pool.request()
			.input("id", mssql.Int, Number(id))
			.input("monto_minimo", mssql.Int, Number(monto_minimo))
			.input("monto_maximo", mssql.Int, Number(monto_maximo))
			.input("cobro_admon", mssql.Int, Number(cobro_admon))
			.query(`
				UPDATE prestamos.cobros_administrativos
				SET monto_minimo = @monto_minimo, monto_maximo = @monto_maximo, cobro_admon = @cobro_admon
				WHERE Id = @id
			`);

		if (result.rowsAffected[0] === 0) {
			return res.status(404).json({ code: "NOT_FOUND", message: "Registro no encontrado" });
		}

		return res.json({ code: "OK", message: "Cobro administrativo actualizado" });
	} catch (err) {
		console.error("cobros-admon/editar:", err);
		return res.status(500).json({ code: "SERVER_ERROR", message: err?.message });
	}
}

export async function eliminarCobro(req, res) {
	try {
		const { id } = req.params;

		const pool = await connection();
		if (pool?.code) return res.status(502).json({ code: "DB_CONN_ERROR", message: pool.message });

		const result = await pool.request()
			.input("id", mssql.Int, Number(id))
			.query(`DELETE FROM prestamos.cobros_administrativos WHERE Id = @id`);

		if (result.rowsAffected[0] === 0) {
			return res.status(404).json({ code: "NOT_FOUND", message: "Registro no encontrado" });
		}

		return res.json({ code: "OK", message: "Cobro administrativo eliminado" });
	} catch (err) {
		console.error("cobros-admon/eliminar:", err);
		return res.status(500).json({ code: "SERVER_ERROR", message: err?.message });
	}
}
