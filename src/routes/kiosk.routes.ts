import { Router } from "express";
import KioskController from "../controllers/kiosk.controller";
import path from "path";
import fs from "fs";

const router = Router();

// Build and download a preconfigured kiosk ZIP (template EXE + kiosk-config.json)
router.post("/build", KioskController.buildKiosk);
// Allow browser GET downloads (convenience for direct browser download links)
router.get("/build", (req, res, next) => {
	// copy query params into body so controller works the same
	req.body = { ...(req.body || {}), ...req.query };
	return KioskController.buildKiosk(req as any, res as any);
});

// GET /template - download the raw EXE template (useful for testing)
router.get("/template", (req, res) => {
	const templatePath = process.env.KIOSK_TEMPLATE_PATH || path.join(process.cwd(), "templates", "Qubit QMS Kiosk.exe");
	if (!fs.existsSync(templatePath)) {
		return res.status(404).json({ success: false, message: `Template not found at ${templatePath}` });
	}
	res.setHeader("Content-Type", "application/vnd.microsoft.portable-executable");
	res.setHeader("Content-Disposition", `attachment; filename="${path.basename(templatePath)}"`);
	res.sendFile(templatePath);
});

export const kioskRoutes = router;
