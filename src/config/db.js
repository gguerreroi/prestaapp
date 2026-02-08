const mssql = require('mssql')
const env = require('./env');

let pool;

async function connection() {
	try {
		// Si ya hay pool conectado, reutilizarlo
		if (pool?.connected) return pool;

		const cfg = {
			user: env.DB.USER,
			password: env.DB.PASSWORD,
			server: env.DB.HOST,
			database: env.DB.NAME,
			port: env.DB.PORT,
			options: {
				encrypt: env.DB.ENCRYPT,
				enableArithAbort: true,
			},
		};

		const connPool = new mssql.ConnectionPool(cfg);
		pool = await connPool.connect();

		pool.on('error', async (e) => {
			console.log('on pool error ', e);
			await close_pool();
		});

		return pool;
	} catch (e) {
		pool = null;
		const message = e?.message || e?.originalError || e;
		return { code: 502, message: `${message}` };
	}
}

async function close_pool() {
	try {
		if (pool) await pool.close();
	} catch (e) {
		console.log(e);
	} finally {
		pool = null;
	}
}

module.exports = { connection, mssql };