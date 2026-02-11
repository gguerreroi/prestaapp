import { connection } from "./db";

/**
 * Ejecuta un SELECT y devuelve un array (recordset).
 * Uso: await dbQuery("SELECT ... WHERE id=@id", { id: 123 })
 */
export async function dbQuery(sql, params = {}) {
	const pool = await connection();

	// si su connection() devuelve {code,message} cuando falla
	if (pool?.code) {
		const err = new Error(pool.message);
		err.code = pool.code;
		throw err;
	}

	const request = pool.request();

	// Parametrización básica (por seguridad)
	for (const [key, value] of Object.entries(params)) {
		// Si quiere tipado fino, aquí podemos mapear por tipos
		request.input(key, value);
	}

	const result = await request.query(sql);
	return result.recordset || [];
}

/**
 * Ejecuta un SP y devuelve un array (primer recordset).
 * Uso: await dbExec("schema.sp_name", { cui13: '...' })
 */
export async function dbExec(spName, params = {}) {
	const pool = await connection();

	if (pool?.code) {
		const err = new Error(pool.message);
		err.code = pool.code;
		throw err;
	}

	const request = pool.request();

	for (const [key, value] of Object.entries(params)) {
		request.input(key, value);
	}

	const result = await request.execute(spName);
	return result.recordsets || [];
}

/**
 * Si necesita OUTPUT params en SP, use esta función.
 */
export async function dbExecWithOutput(spName, { input = {}, output = {} } = {}) {
	const pool = await connection();

	if (pool?.code) {
		const err = new Error(pool.message);
		err.code = pool.code;
		throw err;
	}

	const request = pool.request();

	for (const [key, value] of Object.entries(input)) {
		request.input(key, value);
	}

	// output: { prestamo_id: mssql.BigInt }
	for (const [key, type] of Object.entries(output)) {
		request.output(key, type);
	}

	const result = await request.execute(spName);
	return { rows: result.recordset || [], output: result.output || {} };
}