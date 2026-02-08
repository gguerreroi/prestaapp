import getInfo from './getInfo.js';

function normalizePathForPermission(pathname) {
	// Decide aquí tu regla. En vez de "primeros 4 segmentos",
	// recomiendo permisos por "módulo" o prefijo.
	// Ej: /customers/123 -> /customers
	const parts = pathname.split('?')[0].split('/').filter(Boolean);
	if (parts.length === 0) return '/';

	// Si tu app tiene /api/... y quieres permisos sobre el módulo real:
	if (parts[0] === 'api') {
		// /api/payments/... -> /payments
		return parts[1] ? `/${parts[1]}` : '/api';
	}

	return `/${parts[0]}`; // módulo principal
}

function requirePermission(permissionKey = null, options = {}) {
	const {
		onDenyView = 'error/403', // o 'system/error-403' según tu proyecto
		isApi = false,
	} = options;

	return function (req, res, next) {
		const user = req.user || req.session?.passport?.user;

		if (!user) {
			// No autenticado
			if (isApi) {
				return res.status(401).json({ code: 401, message: 'Unauthorized' });
			}
			return res.redirect('/auth');
		}

		const permissions = Array.isArray(user.permission)
			? user.permission
			: (typeof user.permission === 'string' ? [user.permission] : []);

		const key = permissionKey || normalizePathForPermission(req.originalUrl);

		if (permissions.includes(key)) return next();

		// Denegado
		if (isApi) {
			return res.status(403).json({ code: 403, message: 'Forbidden' });
		}

		const info = getInfo(req);
		return res.status(403).render(onDenyView, {
			...info,
			userInfo: user,
			requiredPermission: key,
		});
	};
}

export default requirePermission;