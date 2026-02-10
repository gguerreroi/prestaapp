import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "clientes");

// Asegura carpeta
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, UPLOAD_DIR);
	},
	filename: function (req, file, cb) {
		// nombre único y seguro
		const ext = path.extname(file.originalname || "").toLowerCase();
		const safeExt = ext && ext.length <= 8 ? ext : ".jpg";
		const stamp = Date.now();
		const rnd = Math.random().toString(16).slice(2);
		cb(null, `${stamp}_${rnd}${safeExt}`);
	},
});

function fileFilter(req, file, cb) {
	// solo imágenes
	if (!file.mimetype?.startsWith("image/")) {
		return cb(new Error("Solo se permiten imágenes."), false);
	}
	cb(null, true);
}

export const uploadCustomerPhotos = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB
	},
}).fields([
	{ name: "cuiFrontal", maxCount: 1 },
	{ name: "cuiDorsal", maxCount: 1 },
	{ name: "fotoVivienda", maxCount: 1 },
	{ name: "fotoPersona", maxCount: 1 },
]);