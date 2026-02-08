function getInfo(req) {
	// Si trust proxy = true, req.ip ya toma el valor correcto.
	// Si quieres x-forwarded-for manual, toma el primero.
	const xff = req.header('x-forwarded-for');
	const ip = (xff ? xff.split(',')[0].trim() : req.ip) || req.connection?.remoteAddress;
	const user = req.user || req.session?.passport?.user || null;

	return {
		user,                 // más neutro que UserInfo
		path: req.originalUrl,
		ip,
	};
}

export default getInfo;