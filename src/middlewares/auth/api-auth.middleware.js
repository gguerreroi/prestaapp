function apiAuth(req, res, next) {
	// Si usas passport con sesión también en API:
	if (req.isAuthenticated)
		return next();

	const auth = req.headers.authorization;
	if (auth && auth.startsWith('Bearer ')) return next();

	return res.status(401).json({
		code: 401,
		message: 'Unauthorized',
	});
}

export default apiAuth;