import { connection, mssql } from "../../config/db"
import outApi from "../../utils/out.api";

async function authController(request, username, password, done){

	let Connection = null;

	try{

		Connection = await connection()

		if (Connection.code > 500) throw {code: Connection.code, message: Connection.message}

		const stmt = await Connection.request();

		stmt.input('strusuario', mssql.VarChar(100), username)
		stmt.input('strpassword', mssql.VarChar(100), password)
		stmt.output('spCodeMessage', mssql.Bit)
		stmt.output('spStrMessage', mssql.VarChar(100))

		await stmt.execute('usuarios.sp_inicio_sesion', function(err, result) {

			if (err) {
				done(null, false, outApi(
					401,
					'Fail run [usuarios].[sp_inicio_sesion]',
					err
				))
			}else {
				const {output, recordsets} = result;

				if (output.spCodeMessage){
					let User = recordsets[0][0];

					User.permission = recordsets[0][0]['PermisosWeb'] != null ? JSON.parse(recordsets[0][0]['PermisosWeb']).map(function (item){
						return item.IDENOMBRE;
					}) : ['/']

					/*
					User.username = DB_USER
					User.password = DB_PASSWORD
					User.database = DB_NAME
					*/
					done(null, User)
				}else {
					done(null, false, outApi(
						401,
						output.spStrMessage,
						err
					))
				}
			}
		})
	}catch (e) {
		console.log(e, 'error authController')
		done(null, false, outApi(
			500,
			`${e.message}`,
			e))
	}
}

export default authController