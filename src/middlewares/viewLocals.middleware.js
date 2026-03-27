import getInfo from "./auth/get-info.middleware";

function viewLocals(req, res, next) {
  res.locals.info = getInfo(req); // { user, path, ip }
  res.locals.user = res.locals.info.user;
  res.locals.clientIp = res.locals.info.ip;

  // Permisos disponibles en todas las vistas (sidebar, acciones rápidas, etc.)
  const userObj = req.user || req.session?.passport?.user;
  res.locals.permission = Array.isArray(userObj?.permission) ? userObj.permission : [];

  const path = req.originalUrl || req.path || "/";

  res.locals.activeMenu =
    path === "/"
      ? "inicio"
      : path.startsWith("/prestamos")
        ? "prestamos"
        : path.startsWith("/clientes")
          ? "clientes"
          : path.startsWith("/cobranza")
            ? "cobranza"
            : path.startsWith("/pagos")
              ? "pagos"
              : path.startsWith("/reportes")
                ? "reportes"
                : path.startsWith("/configuracion")
                  ? "configuracion"
                  : "";
  return next();
}

export default viewLocals;
