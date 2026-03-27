import { Router} from "express"
import appAuth from "../../middlewares/auth/app-auth.middleware"
import { dbExec } from "../../config/db.query"

const router = Router();

// URL base: /clientes
router.get('/nuevo', appAuth, (req, res)=> {
	res.render('clientes/cliente-nuevo', {
		pageScripts: ['/assets/js/custom/nuevo-cliente.js']
	})
})

router.get('/:id', appAuth, async (req, res)=> {
	const { id } = req.params;
	const c = await dbExec("clientes.sp_cliente_detalle", {cui9: id })

	res.render('clientes/cliente-detalle', {
		title: `Cliente #${id}`,
		pageScripts: ['/assets/js/custom/cliente-detalle.js'],
		cliente: c[0][0],
		prestamos: c[1],
		resumen: c[2][0]
	})
})

router.get('/', appAuth, (req, res)=> {
	res.render('clientes/clientes', {
		pageScripts: ['/assets/js/custom/listado-clientes.js']
	})
})

export default router;