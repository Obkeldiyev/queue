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
	const templatePath = process.env.KIOSK_TEMPLATE_PATH || path.join(process.cwd(), "templates", "win-unpacked", "Qubit QMS Kiosk.exe");
	if (!fs.existsSync(templatePath)) {
		return res.status(404).json({ success: false, message: `Template not found at ${templatePath}` });
	}
	res.setHeader("Content-Type", "application/vnd.microsoft.portable-executable");
	res.setHeader("Content-Disposition", `attachment; filename="${path.basename(templatePath)}"`);
	res.sendFile(templatePath);
});

// GET /receipt-preview — returns the receipt HTML with sample data so you can view/edit it in a browser
// Usage: https://xnavbat.polito.uz/api/v1/kiosk/receipt-preview?lang=uz&branch=Main+Branch&queue=Qabul&ticket=A005&pos=3&wait=14
router.get("/receipt-preview", (req, res) => {
	const lang = (req.query.lang as string) || "uz";
	const branchName = (req.query.branch as string) || "Bosh filial";
	const ticketNumber = (req.query.ticket as string) || "A005";
	const queueName = (req.query.queue as string) || "Qabul";
	const counterName = (req.query.counter as string) || undefined;
	const position = req.query.pos != null ? Number(req.query.pos) : 3;
	const estimatedWaitMins = req.query.wait != null ? Number(req.query.wait) : 14;

	const L: Record<string, { title: string; service: string; window: string; pos: string; wait: string; min: string; thanks: string }> = {
		uz: { title: "NAVBAT CHIPTASI", service: "XIZMAT",  window: "KABINET", pos: "NAVBAT RAQAMI",    wait: "KUTISH VAQTI",      min: "daqiqa", thanks: "Xizmatdan foydalanganingiz uchun rahmat!" },
		ru: { title: "ТАЛОН ОЧЕРЕДИ",   service: "УСЛУГА",   window: "КАБИНЕТ", pos: "НОМЕР В ОЧЕРЕДИ", wait: "ВРЕМЯ ОЖИДАНИЯ",    min: "минут",  thanks: "Спасибо за обращение!" },
		en: { title: "QUEUE TICKET",    service: "SERVICE",  window: "WINDOW",  pos: "QUEUE POSITION",  wait: "EST. WAIT TIME",    min: "minutes",thanks: "Thank you for your visit!" },
	};
	const t = L[lang] ?? L["en"];

	const now = new Date();
	const dateStr = now.toLocaleDateString(lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" });
	const timeStr = now.toLocaleTimeString(lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" });

	const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=640"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:640px;background:#fff;color:#000;font-family:'Courier New',Courier,monospace;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{padding:24px 28px 32px}
.org{font-size:26px;font-weight:900;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:4px;word-break:break-word;color:#000}
.title{font-size:15px;font-weight:700;text-align:center;letter-spacing:3px;text-transform:uppercase;color:#000;margin-bottom:16px}
.hr-solid{border:none;border-top:2.5px solid #000;margin:14px 0}
.hr-dash{border:none;border-top:2px dashed #000;margin:14px 0}
.pos-label{font-size:16px;font-weight:700;text-align:center;letter-spacing:3px;text-transform:uppercase;color:#000;margin-bottom:6px}
.ticket-num{font-size:120px;font-weight:900;text-align:center;letter-spacing:6px;line-height:1;color:#000;margin:10px 0 16px}
.box{border:3px solid #000;padding:10px 14px;margin:10px 0;text-align:center}
.box-lbl{font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#000;margin-bottom:5px}
.box-val{font-size:24px;font-weight:900;color:#000;word-break:break-word}
.info-row{display:flex;justify-content:space-between;align-items:center;font-size:17px;font-weight:700;padding:9px 0;border-bottom:1.5px solid #000;color:#000}
.info-row:last-child{border-bottom:none}
.info-lbl{text-transform:uppercase;letter-spacing:1px;color:#000;font-weight:700}
.info-val{font-weight:900;text-align:right;color:#000}
.thanks{text-align:center;font-size:18px;font-weight:900;color:#000;padding:14px 0 6px}
.brand{text-align:center;font-size:14px;font-weight:700;color:#000;letter-spacing:2px;margin-top:5px}
.datetime{text-align:center;font-size:14px;font-weight:700;color:#000;margin-top:8px;letter-spacing:1px}
@page{size:80mm auto;margin:0}
@media print{html,body{width:640px}}
</style></head><body>
<div class="org">${branchName}</div>
<div class="title">${t.title}</div>
<div class="hr-solid"></div>
<div class="pos-label">${t.pos}</div>
<div class="ticket-num">${ticketNumber}</div>
<div class="hr-dash"></div>
<div class="box"><div class="box-lbl">${t.service}</div><div class="box-val">${queueName}</div></div>
${counterName ? `<div class="box"><div class="box-lbl">${t.window}</div><div class="box-val">${counterName}</div></div>` : ""}
<div class="hr-dash"></div>
<div class="info-row"><span class="info-lbl">${t.pos}</span><span class="info-val">${position}</span></div>
<div class="info-row"><span class="info-lbl">${t.wait}</span><span class="info-val">~${estimatedWaitMins} ${t.min}</span></div>
<div class="hr-solid"></div>
<div class="thanks">${t.thanks}</div>
<div class="brand">Qubit QMS</div>
<div class="datetime">${dateStr} &nbsp; ${timeStr}</div>
</body></html>`;

	res.setHeader("Content-Type", "text/html; charset=utf-8");
	res.send(html);
});

export const kioskRoutes = router;
