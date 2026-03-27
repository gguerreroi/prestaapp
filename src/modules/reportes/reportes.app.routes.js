import { Router } from "express"
import appAuth from "../../middlewares/auth/app-auth.middleware"
import requirePermission from "../../middlewares/auth/permission.middleware"
import { dbQuery } from "../../config/db.query"

const router = Router();

// URL base: /reportes
router.get('/', appAuth, requirePermission('/reportes'), (req, res) => {
	res.render('reportes/reportes', {
		title: 'Reportes'
	})
})

// GET /reportes/cobranza-semanal?semana=2026-02-10
router.get('/cobranza-semanal', appAuth, requirePermission('/reportes'), async (req, res) => {
	try {
		// Calcular lunes de la semana solicitada (o la semana actual)
		let lunes;
		if (req.query.semana) {
			lunes = new Date(req.query.semana + 'T00:00:00')
		} else {
			lunes = new Date()
			const day = lunes.getDay() // 0=dom, 1=lun...
			const diff = day === 0 ? 6 : day - 1 // si es domingo retrocede 6, si no retrocede (day-1)
			lunes.setDate(lunes.getDate() - diff)
		}
		lunes.setHours(0, 0, 0, 0)

		const domingo = new Date(lunes)
		domingo.setDate(lunes.getDate() + 6)

		// Generar las 7 fechas de la semana
		const diasSemana = []
		const nombresdia = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo']
		for (let i = 0; i < 7; i++) {
			const d = new Date(lunes)
			d.setDate(lunes.getDate() + i)
			diasSemana.push({
				nombre: nombresdia[i],
				fecha: d.toISOString().slice(0, 10), // YYYY-MM-DD
				fechaCorta: `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
			})
		}

		const fechaLunes = lunes.toISOString().slice(0, 10)
		const fechaDomingo = domingo.toISOString().slice(0, 10)

		// Semana anterior y siguiente para navegación
		const lunesAnterior = new Date(lunes)
		lunesAnterior.setDate(lunes.getDate() - 7)
		const lunesSiguiente = new Date(lunes)
		lunesSiguiente.setDate(lunes.getDate() + 7)

		// Filtro por agente
		const filtroAgenteId = req.query.agente ? Number(req.query.agente) : null
		const whereAgente = filtroAgenteId ? 'AND c.cartera_id = @agenteId' : ''

		// Query principal
		const queryParams = { fechaLunes, fechaDomingo }
		if (filtroAgenteId) queryParams.agenteId = filtroAgenteId

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
		`, queryParams)

		// Agrupar por prestamo_id
		const prestamosMap = new Map()
		for (const row of rows) {
			const key = row.prestamo_id
			if (!prestamosMap.has(key)) {
				prestamosMap.set(key, {
					prestamo_id: row.prestamo_id,
					cui9: row.cui9,
					cliente_nombre: row.cliente_nombre,
					agente_nombre: row.agente_nombre,
					cartera_id: row.cartera_id,
					principal: row.principal,
					cuota_diaria: row.cuota_diaria,
					total_pagar: row.total_pagar,
					saldo: row.saldo,
					dias: {} // { 'YYYY-MM-DD': { cuota_programada, monto_pagado, estado_cuota } }
				})
			}
			if (row.fecha_cuota) {
				const fechaKey = new Date(row.fecha_cuota).toISOString().slice(0, 10)
				prestamosMap.get(key).dias[fechaKey] = {
					cuota_programada: row.cuota_programada,
					monto_pagado: row.monto_pagado,
					estado_cuota: row.estado_cuota
				}
			}
		}

		const prestamos = Array.from(prestamosMap.values())

		// Obtener agentes para el filtro
		const agentes = await dbQuery(`
			SELECT agente_id, codigo, nombres + ' ' + ISNULL(apellidos,'') AS nombre
			FROM prestamos.agentes
			WHERE _estado = 'AC'
			ORDER BY nombres
		`)

		res.render('reportes/cobranza-semanal', {
			title: 'Cobranza Semanal',
			pageScripts: ['/assets/js/custom/cobranza-semanal.js'],
			diasSemana,
			fechaLunes,
			fechaDomingo,
			semanaAnterior: lunesAnterior.toISOString().slice(0, 10),
			semanaSiguiente: lunesSiguiente.toISOString().slice(0, 10),
			prestamos,
			agentes,
			filtroAgente: req.query.agente || ''
		})

	} catch (err) {
		console.error('Error en cobranza-semanal:', err)
		res.status(500).render('error/500', { error: err.message })
	}
})

export default router;
