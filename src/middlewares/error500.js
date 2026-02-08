function error500(err, req, res, next) {
	// Evita intentar responder dos veces si algo ya escribió respuesta
	if (res.headersSent) return next(err);

	console.error('Se produjo un error:', err);

	if (req.path.startsWith('/api')) {
		return res.status(500).json({
			code: 500,
			message: 'Internal Server Error',
		});
	}

	return res.status(500).render('error/500', {
		path: req.path,
		error: err,        // si no quieres exponer detalles en prod, luego lo ocultamos
		userInfo: 'Error general',
	});
}

export default error500;