import { Router } from "express"
import path from "path"
import puppeteer from "puppeteer"
import ejs from "ejs"
import appAuth from "../../middlewares/auth/app-auth.middleware"
import requirePermission from "../../middlewares/auth/permission.middleware"
import { dbExec } from "../../config/db.query"

const router = Router();
// URL base: /prestamos
router.get('/nuevo', appAuth, requirePermission('/prestamos'), (req, res)=> {
	res.render('prestamo/prestamo-nuevo', {
		pageScripts: ['/assets/js/custom/nuevo-prestamo.js']
	})
})

// ─── PDF del préstamo ───
router.get('/pdf/:id', appAuth, requirePermission('/prestamos'), async (req, res)=> {
	let browser = null
	try {
		const { id } = req.params
		const p = await dbExec("prestamos.sp_prestamo_detalle", { prestamo_id: id })
		const prestamo = p[0][0]
		const plan = p[1]
		const totales = p[2][0]

		if (!prestamo) {
			return res.status(404).json({ error: 'Préstamo no encontrado' })
		}

		const templatePath = path.resolve(__dirname, '../../views/prestamo/prestamo-print.ejs')
		const html = await ejs.renderFile(templatePath, { prestamo, plan, totales })

		browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
		const page = await browser.newPage()
		await page.setContent(html, { waitUntil: 'networkidle0' })

		const pdfBuffer = await page.pdf({
			format: 'Letter',
			landscape: false,
			printBackground: true,
			margin: { top: '8mm', bottom: '8mm', left: '10mm', right: '10mm' }
		})

		const filename = `prestamo-${id}.pdf`
		res.setHeader('Content-Type', 'application/pdf')
		res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
		res.send(pdfBuffer)

	} catch (err) {
		console.error('Error en prestamo/pdf:', err)
		res.status(500).json({ error: 'Error al generar el PDF' })
	} finally {
		if (browser) await browser.close()
	}
})

router.get('/:id', appAuth, requirePermission('/prestamos'), async (req, res)=> {
	const { id } = req.params;
	const p = await dbExec("prestamos.sp_prestamo_detalle", {prestamo_id: id })

	res.render('prestamo/prestamo-detalle', {
		title: `Préstamo #${id}`,
		pageScripts: ['/assets/js/custom/prestamo-detalle.js'],
		prestamo: p[0][0],
		plan: p[1],
		totales: p[2][0]
	})
})

router.get('/', appAuth, requirePermission('/prestamos'), (req, res)=> {
	res.render('prestamo/prestamos', {
		pageScripts: ['/assets/js/custom/listado-prestamo.js']
	})
})

export default router;