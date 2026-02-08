const Sequelize = require("sequelize");
import env from "./env"

const sequelizeSession  = new Sequelize({
	dialect: 'mssql',
	schema: 'usuarios',
	tableName: "sessions",
	host: env.DB.HOST,
	username: env.DB.USER,
	password: env.DB.PASSWORD,
	database: env.DB.NAME,
	port: env.DB.PORT || 1433,
	dialectOptions: {
		options: {
			encrypt: env.DB.ENCRYPT,
			enableArithAbort: true
		}
	}
})

export default sequelizeSession