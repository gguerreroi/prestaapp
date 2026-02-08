function requireSessionAuth(req, res, next) {
	if (req.isAuthenticated && req.isAuthenticated()) return next();
	return res.render('auth',{
		layout: 'layouts/auth',
		title: 'Iniciar sesión',
		pageScripts: ['/assets/js/custom/auth.js']
	});
}

export default requireSessionAuth;