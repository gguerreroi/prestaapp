import { connection, mssql } from "../../config/db.js";

function normalizeCuotasCsv(input) {
  if (Array.isArray(input)) {
    return input
      .map((v) => String(v).trim())
      .filter((v) => /^\d+$/.test(v))
      .join(",");
  }

  return String(input || "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^\d+$/.test(v))
    .join(",");
}

export async function reversarPago(req, res) {
  try {
    const pool = await connection();
    if (pool?.code) {
      return res.status(502).json({
        code: "DB_CONN_ERROR",
        message: pool.message,
        data: [],
      });
    }

    const rawPrestamoId = req.params.prestamo_id ?? req.body?.prestamo_id;
    const rawCuotas = req.body?.cuotas_csv ?? req.body?.cuotas ?? "";

    const prestamoId = Number(rawPrestamoId);
    const cuotasCsv = normalizeCuotasCsv(rawCuotas);

    if (!prestamoId || Number.isNaN(prestamoId) || prestamoId <= 0) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "prestamo_id inválido.",
        data: [],
      });
    }

    if (!cuotasCsv) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Debe enviar al menos una cuota válida.",
        data: [],
      });
    }

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;

    const usuarioModifico =
      req.user?.username || req.user?.name || req.user?.email || null;

    if (!usuarioModifico) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "No se pudo determinar el usuario autenticado.",
        data: [],
      });
    }

    const result = await pool
      .request()
      .input("prestamo_id", mssql.BigInt, prestamoId)
      .input("cuotas_csv", mssql.VarChar(mssql.MAX), cuotasCsv)
      .input("usuario_modifico", mssql.NVarChar(100), usuarioModifico)
      .input("ip", mssql.VarChar(45), ip)
      .execute("prestamos.sp_reversar_pago");

    const sp = result?.recordset?.[0];

    if (!sp) {
      return res.status(500).json({
        code: "SP_EMPTY_RESPONSE",
        message: "El procedimiento no devolvió respuesta.",
        data: [],
      });
    }

    if (sp.ok !== 1) {
      const msg = sp.mensaje || "No fue posible reversar el pago.";

      if (msg.toLowerCase().includes("no existe")) {
        return res.status(404).json({
          code: "NOT_FOUND",
          message: msg,
          data: [],
        });
      }

      return res.status(400).json({
        code: "SP_ERROR",
        message: msg,
        data: [
          {
            prestamo_id: sp.prestamo_id ?? prestamoId,
            error_number: sp.error_number ?? null,
            error_state: sp.error_state ?? null,
            error_line: sp.error_line ?? null,
          },
        ],
      });
    }

    return res.status(200).json({
      code: "OK",
      message: sp.mensaje || "Pago revertido correctamente.",
      data: [
        {
          prestamo_id: sp.prestamo_id ?? prestamoId,
          cuotas_revertidas: sp.cuotas_revertidas ?? 0,
          procesado_utc: sp.procesado_utc ?? null,
        },
      ],
    });
  } catch (err) {
    console.error("reversePayment error:", err);

    return res.status(500).json({
      code: "SERVER_ERROR",
      message: err?.message || "Error reversando pago",
      data: [],
    });
  }
}
