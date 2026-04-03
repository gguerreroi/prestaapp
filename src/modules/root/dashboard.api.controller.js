import { connection, mssql } from "../../config/db.js";

export async function dashboardStats(req, res) {
	try {
		const pool = await connection();
		if (pool?.code) {
			return res.status(502).json({ code: "DB_CONN_ERROR", message: pool.message });
		}

		const user = req.user || req.session?.passport?.user;
		const codusuario = user?.codusuario;

		if (!codusuario) {
			return res.status(401).json({ code: "UNAUTHORIZED", message: "No autenticado" });
		}

		// All queries filtered by user's assigned agents via usuarios.rel_agentes
		const result = await pool.request()
			.input("codusuario", mssql.Int, codusuario)
			.query(`
				-- Agentes del usuario
				DECLARE @agentes TABLE (agente_id INT);
				INSERT INTO @agentes
				SELECT agente_id FROM usuarios.rel_agentes WHERE codusuario = @codusuario;

				-- 1) KPI: Cobros de hoy (cuotas pagadas hoy)
				SELECT ISNULL(SUM(d.monto_pagado), 0) AS cobros_hoy
				FROM prestamos.detalle d
				INNER JOIN prestamos.core p ON p.prestamo_id = d.prestamo_id
				INNER JOIN clientes.core c ON c.cui9 = p.cui9
				WHERE c.cartera_id IN (SELECT agente_id FROM @agentes)
				  AND CAST(d.fecha_pago AS DATE) = CAST(GETDATE() AS DATE);

				-- 2) KPI: Cuotas pendientes hoy (vencidas o de hoy)
				SELECT COUNT(*) AS cuotas_pendientes_hoy
				FROM prestamos.detalle d
				INNER JOIN prestamos.core p ON p.prestamo_id = d.prestamo_id
				INNER JOIN clientes.core c ON c.cui9 = p.cui9
				WHERE c.cartera_id IN (SELECT agente_id FROM @agentes)
				  AND d.estado = 'Pendiente'
				  AND d.fecha_cuota <= CAST(GETDATE() AS DATE);

				-- 3) KPI: Préstamos activos
				SELECT COUNT(*) AS prestamos_activos
				FROM prestamos.core p
				INNER JOIN clientes.core c ON c.cui9 = p.cui9
				WHERE c.cartera_id IN (SELECT agente_id FROM @agentes)
				  AND p.estado = 'ACTIVO';

				-- 4) KPI: Total clientes
				SELECT COUNT(*) AS total_clientes
				FROM clientes.core c
				WHERE c.cartera_id IN (SELECT agente_id FROM @agentes)
				  AND c._estado = 'AC';

				-- 5) KPI: Capital colocado (sum de principal en préstamos activos)
				SELECT ISNULL(SUM(p.principal), 0) AS capital_colocado,
				       ISNULL(SUM(p.total_pagar), 0) AS total_por_cobrar
				FROM prestamos.core p
				INNER JOIN clientes.core c ON c.cui9 = p.cui9
				WHERE c.cartera_id IN (SELECT agente_id FROM @agentes)
				  AND p.estado = 'ACTIVO';

				-- 6) KPI: Total cobrado (sum pagos)
				SELECT ISNULL(SUM(d.monto_pagado), 0) AS total_cobrado
				FROM prestamos.detalle d
				INNER JOIN prestamos.core p ON p.prestamo_id = d.prestamo_id
				INNER JOIN clientes.core c ON c.cui9 = p.cui9
				WHERE c.cartera_id IN (SELECT agente_id FROM @agentes);

				-- 7) Cuotas atrasadas
				SELECT COUNT(*) AS cuotas_atrasadas,
				       ISNULL(SUM(d.cuota_programada + d.mora), 0) AS monto_atrasado
				FROM prestamos.detalle d
				INNER JOIN prestamos.core p ON p.prestamo_id = d.prestamo_id
				INNER JOIN clientes.core c ON c.cui9 = p.cui9
				WHERE c.cartera_id IN (SELECT agente_id FROM @agentes)
				  AND d.estado IN ('ATRASADO', 'MOROSO');

				-- 8) Actividad reciente (últimos 10 pagos)
				SELECT TOP 10
					d.fecha_pago,
					d.monto_pagado,
					d.dia_num,
					p.prestamo_id,
					c.nombres + ' ' + c.apellidos AS cliente_nombre,
					c.cui9
				FROM prestamos.detalle d
				INNER JOIN prestamos.core p ON p.prestamo_id = d.prestamo_id
				INNER JOIN clientes.core c ON c.cui9 = p.cui9
				WHERE c.cartera_id IN (SELECT agente_id FROM @agentes)
				  AND d.fecha_pago IS NOT NULL
				ORDER BY d.fecha_pago DESC;

				-- 9) Próximas cuotas de hoy
				SELECT TOP 10
					d.fecha_cuota,
					d.cuota_programada,
					d.mora,
					d.estado AS cuota_estado,
					p.prestamo_id,
					c.nombres + ' ' + c.apellidos AS cliente_nombre,
					c.cui9,
					c.telefono
				FROM prestamos.detalle d
				INNER JOIN prestamos.core p ON p.prestamo_id = d.prestamo_id
				INNER JOIN clientes.core c ON c.cui9 = p.cui9
				WHERE c.cartera_id IN (SELECT agente_id FROM @agentes)
				  AND d.estado = 'Pendiente'
				  AND d.fecha_cuota = CAST(GETDATE() AS DATE)
				ORDER BY c.apellidos, c.nombres;
			`);

		const rs = result.recordsets;
		return res.json({
			code: "OK",
			data: {
				cobros_hoy:           rs[0][0]?.cobros_hoy ?? 0,
				cuotas_pendientes_hoy: rs[1][0]?.cuotas_pendientes_hoy ?? 0,
				prestamos_activos:    rs[2][0]?.prestamos_activos ?? 0,
				total_clientes:       rs[3][0]?.total_clientes ?? 0,
				capital_colocado:     rs[4][0]?.capital_colocado ?? 0,
				total_por_cobrar:     rs[4][0]?.total_por_cobrar ?? 0,
				total_cobrado:        rs[5][0]?.total_cobrado ?? 0,
				cuotas_atrasadas:     rs[6][0]?.cuotas_atrasadas ?? 0,
				monto_atrasado:       rs[6][0]?.monto_atrasado ?? 0,
				actividad_reciente:   rs[7] || [],
				cobranza_hoy:         rs[8] || [],
			}
		});
	} catch (err) {
		console.error("dashboard/stats error:", err);
		return res.status(500).json({ code: "SERVER_ERROR", message: err?.message });
	}
}
