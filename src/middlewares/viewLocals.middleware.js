import getInfo from '../middlewares/auth/getInfo';

function viewLocals(req, res, next) {
	res.locals.info = getInfo(req);      // { user, path, ip }
	res.locals.user = res.locals.info.user;
	res.locals.clientIp = res.locals.info.ip;
	next();
}


export default viewLocals