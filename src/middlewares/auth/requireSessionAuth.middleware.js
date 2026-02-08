function requireSessionAuth(req, res, next) {
	if (req.isAuthenticated && req.isAuthenticated()) return next();
	return res.render('auth/login',{
		layout: 'layouts/auth',
		pageScripts: ['/assets/js/custom/auth.js']
	});
}

export default requireSessionAuth;