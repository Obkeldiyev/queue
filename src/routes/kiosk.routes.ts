import { Router } from "express";
import KioskController from "../controllers/kiosk.controller";
import path from "path";
import fs from "fs";

const router = Router();

// Build and download a preconfigured kiosk ZIP (template EXE + kiosk-config.json)
router.post("/build", KioskController.buildKiosk);
// Allow browser GET downloads (convenience for direct browser download links)
router.get("/build", (req, res, next) => {
	req.body = { ...(req.body || {}), ...req.query };
	return KioskController.buildKiosk(req as any, res as any);
});

// GET /template - download the raw EXE template (useful for testing)
router.get("/template", (req, res) => {
	const templatePath = process.env.KIOSK_TEMPLATE_PATH || path.join(process.cwd(), "templates", "win-unpacked", "Qubit QMS Kiosk.exe");
	if (!fs.existsSync(templatePath)) {
		return res.status(404).json({ success: false, message: `Template not found at ${templatePath}` });
	}
	res.setHeader("Content-Type", "application/vnd.microsoft.portable-executable");
	res.setHeader("Content-Disposition", `attachment; filename="${path.basename(templatePath)}"`);
	res.sendFile(templatePath);
});

// GET /receipt-preview — live preview of the receipt HTML in the browser
// https://xnavbat.polito.uz/api/v1/kiosk/receipt-preview?lang=uz&branch=Bosh+filial&ticket=A005&queue=Qabul&pos=3&wait=14&counter=1-kabinet
router.get("/receipt-preview", (req, res) => {
	const lang = (req.query.lang as string) || "uz";
	const branchName = (req.query.branch as string) || "Bosh filial";
	const ticketNumber = (req.query.ticket as string) || "A005";
	const queueName = (req.query.queue as string) || "Qabul";
	const counterName = (req.query.counter as string) || undefined;
	const position = req.query.pos != null ? Number(req.query.pos) : 3;
	const estimatedWaitMins = req.query.wait != null ? Number(req.query.wait) : 14;

	const L: Record<string, { serviceLabel: string; before: string; ta: string }> = {
		uz: { serviceLabel: "Xizmat turi:", before: "Sizdan oldingi navbat:", ta: "ta" },
		ru: { serviceLabel: "Тип услуги:", before: "Перед вами в очереди:", ta: "чел." },
		en: { serviceLabel: "Service type:", before: "People before you:", ta: "" },
	};
	const t = L[lang] ?? L["uz"];
	const now = new Date();
	const dateStr = now.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
	const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
	const beforeCount = Math.max(0, position - 1);

	const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:72mm;margin:0;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{padding:2mm 2mm 2mm}
.outer{border:0.5mm dashed #000;padding:4mm 4mm 5mm;width:100%}
.org{font-size:5mm;font-weight:900;text-align:center;margin-bottom:5mm;word-break:break-word;color:#000;line-height:1.3}
.ticket-num{font-size:28mm;font-weight:900;text-align:center;letter-spacing:1mm;line-height:1;color:#000;margin:3mm 0 4mm}
.service-label{font-size:3.5mm;text-align:center;color:#000;margin-bottom:2mm}
.service-box{border:0.5mm solid #000;padding:2.5mm 3mm;text-align:center;margin-bottom:5mm}
.service-name{font-size:5.5mm;font-weight:900;color:#000}
.before{font-size:4.5mm;text-align:center;color:#000;margin-bottom:5mm}
.before strong{font-weight:900}
.divider{border:none;border-top:0.6mm solid #000;margin:0 0 3mm}
.datetime{display:flex;justify-content:space-between;font-size:4mm;font-style:italic;color:#000;font-weight:700}
@page{size:72mm auto;margin:0}
@media print{html,body{width:72mm;margin:0}}
</style></head><body>
<div class="outer">
  <div class="org">${branchName}</div>
  <div class="ticket-num">${ticketNumber}</div>
  <div class="service-label">${t.serviceLabel}</div>
  <div class="service-box"><div class="service-name">${queueName}</div></div>
  <div class="before">${t.before} <strong>${beforeCount} ${t.ta}</strong></div>
  <hr class="divider"/>
  <div class="datetime"><span>${dateStr}</span><span>${timeStr}</span></div>
</div>
</body></html>`;

	res.setHeader("Content-Type", "text/html; charset=utf-8");
	res.send(html);
});

export const kioskRoutes = router;
