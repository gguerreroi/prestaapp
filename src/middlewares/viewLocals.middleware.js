import getInfo from '../middlewares/auth/getInfo';

function viewLocals(req, res, next) {
	res.locals.info = getInfo(req);      // { user, path, ip }
	res.locals.user = res.locals.info.user;
	res.locals.clientIp = res.locals.info.ip;

	const path = req.originalUrl || req.path || "/";

	res.locals.activeMenu =
		path === "/" ? "inicio"
			: path.startsWith("/prestamos") ? "prestamos"
				: path.startsWith("/clientes") ? "clientes"
					: path.startsWith("/pagos") ? "pagos"
						: path.startsWith("/reportes") ? "reportes"
							: path.startsWith("/configuracion") ? "configuracion"
								: "";
	return next();
}


export default viewLocals