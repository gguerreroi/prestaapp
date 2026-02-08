function requireApiAuth(req, res, next) {
	// Si usas passport con sesión también en API:
	if (req.isAuthenticated && req.isAuthenticated()) return next();

	// Si la API usa Bearer Token/JWT, aquí solo validas "que venga",
	// pero OJO: debería existir otro middleware que lo valide realmente.
	const auth = req.headers.authorization;
	if (auth && auth.startsWith('Bearer ')) return next();

	return res.status(401).json({
		code: 401,
		message: 'Unauthorized',
	});
}

export default requireApiAuth;