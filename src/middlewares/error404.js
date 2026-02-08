function error404(req, res) {
	if (req.path.startsWith('/api')) {
		return res.status(404).json({
			code: 404,
			message: 'Not Found',
		});
	}

	return res.status(404).render('error/404', {
		path: req.path,
	});
}

export default error404;