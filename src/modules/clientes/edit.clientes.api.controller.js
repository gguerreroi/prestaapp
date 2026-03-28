import { connection, mssql } from "../../config/db.js";

function normalizeDigits(input) {
  return String(input || "")
    .replace(/[\s_\-]/g, "")
    .replace(/\D/g, "");
}

function normalizeText(input) {
  if (input === undefined || input === null) return null;
  const value = String(input).trim();
  return value === "" ? null : value;
}

export async function editCustomer(req, res) {
  try {
    const pool = await connection();
    if (pool?.code) {
      return res.status(502).json({
        code: "DB_CONN_ERROR",
        message: pool.message,
        data: [],
      });
    }

    const rawCui9 = req.params.cui9 ?? "";
    const {
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
    } = req.body || {};

    const cui9 = normalizeDigits(rawCui9);

    if (!cui9 || cui9.length !== 9) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "cui9 inválido: deben ser exactamente 9 dígitos.",
        data: [],
      });
    }

    if (!normalizeText(nombres)) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "nombres es obligatorio.",
        data: [],
      });
    }

    if (!normalizeText(apellidos)) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "apellidos es obligatorio.",
        data: [],
      });
    }
    /*
    if (!normalizeText(estado) || String(estado).trim().length !== 2) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "estado es obligatorio y debe tener 2 caracteres.",
        data: [],
      });
    }
    */
    const carteraIdValue =
      cartera_id === undefined || cartera_id === null || cartera_id === ""
        ? null
        : Number(cartera_id);

    if (carteraIdValue !== null && Number.isNaN(carteraIdValue)) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "cartera_id debe ser numérico.",
        data: [],
      });
    }

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;

    const result = await pool
      .request()
      .input("cui9", mssql.Char(9), cui9)
      .input("nombres", mssql.NVarChar(120), normalizeText(nombres))
      .input("apellidos", mssql.NVarChar(120), normalizeText(apellidos))
      .input("direccion", mssql.NVarChar(300), normalizeText(direccion))
      .input("telefono", mssql.NVarChar(25), normalizeText(telefono))
      .input("cartera_id", mssql.Int, carteraIdValue)
      .input(
        "observaciones",
        mssql.NVarChar(mssql.MAX),
        normalizeText(observaciones),
      )
      .input(
        "referencias_vivienda",
        mssql.NVarChar(500),
        normalizeText(referencias_vivienda),
      )
      .input(
        "img_cui_frontal_url",
        mssql.NVarChar(500),
        normalizeText(img_cui_frontal_url),
      )
      .input(
        "img_cui_dorsal_url",
        mssql.NVarChar(500),
        normalizeText(img_cui_dorsal_url),
      )
      .input(
        "img_vivienda_url",
        mssql.NVarChar(500),
        normalizeText(img_vivienda_url),
      )
      .input(
        "img_persona_url",
        mssql.NVarChar(500),
        normalizeText(img_persona_url),
      )
      //.input("estado", mssql.Char(2), String(estado).trim().toUpperCase())
      .input(
        "usuario",
        mssql.NVarChar(80),
        req.user?.username || req.user?.name || req.user?.email || null,
      )
      .input("ip", mssql.NVarChar(45), ip)
      .execute("clientes.sp_editar_cliente");

    const sp = result?.recordset?.[0];

    if (!sp) {
      return res.status(500).json({
        code: "SP_EMPTY_RESPONSE",
        message: "El procedimiento no devolvió respuesta.",
        data: [],
      });
    }

    if (sp.ok !== 1) {
      const msg = sp.mensaje || "No fue posible actualizar el cliente.";

      if (
        msg.toLowerCase().includes("no existe un cliente") ||
        msg.toLowerCase().includes("no encontrado")
      ) {
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
            cui9: sp.cui9 ?? cui9,
            error_number: sp.error_number ?? null,
            error_state: sp.error_state ?? null,
            error_line: sp.error_line ?? null,
          },
        ],
      });
    }

    return res.status(200).json({
      code: "OK",
      message: sp.mensaje || "Cliente actualizado correctamente.",
      data: [
        {
          cui9: sp.cui9 || cui9,
        },
      ],
    });
  } catch (err) {
    console.error("editCustomer error:", err);

    return res.status(500).json({
      code: "SERVER_ERROR",
      message: err?.message || "Error actualizando cliente",
      data: [],
    });
  }
}
