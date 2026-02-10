import { connection, mssql } from "../../config/db";
import getInfo from "../../middlewares/auth/getInfo"; // ajuste el path según su proyecto

function getFileUrl(req, file) {
	if (!file) return null;

	// quedará como: /uploads/clientes/archivo.jpg
	const rel = file.path.replace(/\\/g, "/"); // windows fix
	const idx = rel.lastIndexOf("/public/");
	const publicPath = idx >= 0 ? rel.slice(idx + "/public".length) : null;

	// Fallback si no encontró "/public"
	const urlPath = publicPath || `/uploads/clientes/${file.filename}`;

	// si quiere URL absoluta:
	// const origin = `${req.protocol}://${req.get("host")}`;
	// return `${origin}${urlPath}`;

	return urlPath;
}

function toInt(val, def = null) {
	const n = Number(val);
	return Number.isFinite(n) ? Math.trunc(n) : def;
}

export async function createLoan(req, res) {
	try {
		const pool = await connection();
		if (pool?.code) {
			return res.status(502).json({ code: "DB_CONN", message: pool.message });
		}

		const info = getInfo(req);
		const usuario = info?.user?.strusuario || info?.user?.codusuario || null;
		const ip = info?.ip || req.ip;

		// ======= BODY =======
		const {
			cui, // puede venir con espacios
			fecha_inicio,
			principal,
			cuota_diaria,
			total_pagar,
			plazo_dias,

			// cliente (solo si no existe)
			nombres,
			apellidos,
			direccion,
			telefono,
			cartera,
			observaciones,
			referencias_vivienda,
			estado_cliente,
		} = req.body;

		// Validaciones mínimas del request (el SP también valida)
		if (!cui) {
			return res.status(400).json({ code: "VALIDATION", message: "cui es obligatorio" });
		}
		if (!fecha_inicio) {
			return res.status(400).json({ code: "VALIDATION", message: "fecha_inicio es obligatoria" });
		}

		const pPrincipal = toInt(principal, null);
		const pCuota = toInt(cuota_diaria, null);
		const pTotal = toInt(total_pagar, null);
		const pPlazo = toInt(plazo_dias, 35);

		if (pPrincipal === null || pCuota === null || pTotal === null) {
			return res.status(400).json({
				code: "VALIDATION",
				message: "principal, cuota_diaria y total_pagar deben ser numéricos",
			});
		}

		// ======= Archivos (si vienen) =======
		const files = req.files || {};
		const img_cui_frontal_url = getFileUrl(req, files?.cuiFrontal?.[0]);
		const img_cui_dorsal_url = getFileUrl(req, files?.cuiDorsal?.[0]);
		const img_vivienda_url = getFileUrl(req, files?.fotoVivienda?.[0]);
		const img_persona_url = getFileUrl(req, files?.fotoPersona?.[0]);

		// ======= Ejecutar SP =======
		const request = pool.request();

		// Inputs
		request.input("cui13", mssql.VarChar(32), String(cui));

		request.input("nombres", mssql.NVarChar(120), nombres ?? null);
		request.input("apellidos", mssql.NVarChar(120), apellidos ?? null);
		request.input("direccion", mssql.NVarChar(300), direccion ?? null);
		request.input("telefono", mssql.NVarChar(25), telefono ?? null);
		request.input("cartera_id", mssql.Int, cartera ? Number(cartera) : null);
		request.input("observaciones", mssql.NVarChar(mssql.MAX), observaciones ?? null);
		request.input("referencias_vivienda", mssql.NVarChar(500), referencias_vivienda ?? null);

		request.input("img_cui_frontal_url", mssql.NVarChar(500), img_cui_frontal_url);
		request.input("img_cui_dorsal_url", mssql.NVarChar(500), img_cui_dorsal_url);
		request.input("img_vivienda_url", mssql.NVarChar(500), img_vivienda_url);
		request.input("img_persona_url", mssql.NVarChar(500), img_persona_url);

		request.input("estado_cliente", mssql.Char(2), estado_cliente ?? "AC");

		// Préstamo
		request.input("fecha_inicio", mssql.Date, fecha_inicio); // YYYY-MM-DD
		request.input("principal", mssql.Int, pPrincipal);
		request.input("cuota_diaria", mssql.Int, pCuota);
		request.input("total_pagar", mssql.Int, pTotal);
		request.input("plazo_dias", mssql.Int, pPlazo);

		// Metadata
		request.input("usuario", mssql.NVarChar(80), usuario ? String(usuario) : null);
		request.input("ip", mssql.NVarChar(45), ip ?? null);

		// Output
		request.output("prestamo_id", mssql.BigInt);

		const result = await request.execute("prestamos.sp_crear_prestamo");

		const prestamoId = result.output?.prestamo_id ?? null;
		const row = result.recordset?.[0] ?? null;

		// Respuesta consistente
		return res.status(201).json({
			ok: true,
			prestamo_id: prestamoId,
			data: row,
			images: {
				img_cui_frontal_url,
				img_cui_dorsal_url,
				img_vivienda_url,
				img_persona_url,
			},
		});
	} catch (err) {
		console.error("createLoan error:", err);

		// Si el SP hace RAISERROR, mssql lo trae en err.message
		return res.status(500).json({
			code: "SP_ERROR",
			message: err?.message || "Error creando préstamo",
		});
	}
}