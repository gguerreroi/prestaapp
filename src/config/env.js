require('dotenv').config();

const required = (key) => {
	if (!process.env[key]) {
		throw new Error(`Falta la variable de entorno: ${key}`);
	}
	return process.env[key];
};

const toBool = (value, keyName) => {
	if (value === true || value === 'true') return true;
	if (value === false || value === 'false' || value === undefined) return false; // default false
	throw new Error(`Valor inválido para ${keyName}. Use 'true' o 'false'.`);
};


module.exports = {
	NODE_ENV: process.env.NODE_ENV || 'development',
	DB: {
		HOST: required('DB_HOST'),
		PORT: Number(process.env.DB_PORT || 1433),
		NAME: required('DB_NAME'),
		USER: required('DB_USER'),
		PASSWORD: required('DB_PASSWORD'),
		ENCRYPT: toBool(process.env.DB_ENCRIPTION, 'DB_ENCRIPTION')
	},
	APP: {
		PORT: Number(process.env.APP_PORT || 3050),
		COOKIE: required('APP_COOKIE_SECRET'),
		SESSION: required('APP_SESSION_SECRET')
	},
	DEBUG: process.env.DEBUG === 'true',
};