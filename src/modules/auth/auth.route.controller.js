
import outApi from "../../utils/out.api";
import passport from "../../middlewares/auth/passport.middleware"
const auth = (req, res, next) => {
	passport.authenticate('api', (err, user, info) => {
		if (err)
			return res.status(500).json(outApi(500, err.message || 'Error en autenticación', err));

		if (!user){
			const message = info?.message || 'Usuario o contraseña inválida';
			return res.status(401).json(outApi(401, message, info));
		}

		req.logIn(user, (err) => {
			if (err)
				return res.status(501).json(outApi(501, 'Error al iniciar sesión', err));

			return res.status(200).json(outApi(200, 'Login Success', req.session));
		})

	})(req, res, next);
}

function logout (request, response, next){
	request.logout(
		function(err){
			console.log('error in logout', err)
			return response.redirect('/')
		}
	)}

export { auth, logout }