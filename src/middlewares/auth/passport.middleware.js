const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
import authController from "../../modules/auth/passport.api.controller";

passport.use('api', new LocalStrategy({
	usernameField: 'username',
	passwordField: 'password',
	passReqToCallback: true
},  authController));

passport.serializeUser(function (user, cb) {
	process.nextTick(function(){
		return cb(null, user)
	})
});

passport.deserializeUser(function (user, cb) {
	process.nextTick(function(){
		return cb(null, user)
	})
})

export default passport