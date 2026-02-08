"use strict";

import express from "express";
import morgan from "morgan";
import path from "path";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";
import session from "express-session";
import passport from "passport";
import SequelizeStoreFactory from "connect-session-sequelize";
import expressLayouts from "express-ejs-layouts";

import env from "./config/env.js";

import appRoutes from "./app.routes";
import apiRoutes from "./api.routes";
import sequelizeSession from "./config/session";
import error404 from "./middlewares/error404";
import error500 from "./middlewares/error500";
import viewLocals from "./middlewares/viewLocals.middleware";

const app = express();

const SequelizeStore = SequelizeStoreFactory(session.Store);

// Config base
app.set("port", env.APP.PORT);
app.set("view engine", "ejs");

// Nota: __dirname no existe en ESM por defecto.
// Si tu build actual sí lo soporta, ok. Si no, te digo cómo arreglarlo abajo.
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", true);
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Middlewares
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser(env.APP.COOKIE));
app.use(fileUpload());
app.use(
	session({
		secret: env.APP.SESSION,
		resave: true,
		saveUninitialized: false,
		store: new SequelizeStore({
			db: sequelizeSession,
		}),
	})
);
app.use(passport.initialize());
app.use(passport.session());
app.use(passport.authenticate("session"));
app.use(viewLocals);

app.use(express.static(path.join(__dirname, "../public")));
app.use("/", appRoutes);
app.use("/api", apiRoutes);

app.use(error500);
app.use(error404);

export default app;