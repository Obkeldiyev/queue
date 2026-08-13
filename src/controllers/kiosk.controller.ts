import { Request, Response } from "express";
import fs from "fs";
import os from "os";
import path from "path";
// Load archiver at runtime to avoid TypeScript compile-time module resolution
const archiver = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return eval("require")("archiver");
  } catch {
    return null as any;
  }
})();
import { exec as _exec } from "child_process";
import { promisify } from "util";
const exec = promisify(_exec);

export class KioskController {
  static async buildKiosk(req: Request, res: Response) {
    try {
      const { deviceId, kioskUrl, apiUrl, printerName, apiToken, fullscreen } = req.body as Record<string, any>;

      const buildOnServer = !!req.body.build;

      // KIOSK_TEMPLATE_PATH should point to the EXE inside the win-unpacked folder.
      // The entire win-unpacked folder (templateDir) is packaged into the ZIP so all
      // Electron runtime files (v8_context_snapshot.bin, snapshot_blob.bin, DLLs, etc.)
      // are included alongside the EXE.
      let templatePath = process.env.KIOSK_TEMPLATE_PATH || path.join(process.cwd(), "templates", "win-unpacked", "Qubit QMS Kiosk.exe");

      if (buildOnServer) {
        const frontendPath = process.env.FRONTEND_PATH || path.join(process.cwd(), "..", "queue_front");
        try {
          await exec("npm ci", { cwd: frontendPath, timeout: 20 * 60 * 1000 });
          await exec("npm run build", { cwd: frontendPath, timeout: 10 * 60 * 1000 });
          await exec("npm run electron:pack", { cwd: frontendPath, timeout: 10 * 60 * 1000 });

          // Locate the win-unpacked directory produced by electron-builder
          const candidates = [
            path.join(frontendPath, "dist", "win-unpacked"),
            path.join(frontendPath, "dist"),
            path.join(frontendPath, "release", "win-unpacked"),
          ];
          let foundDir: string | null = null;
          for (const cand of candidates) {
            if (!fs.existsSync(cand)) continue;
            const files = fs.readdirSync(cand);
            const exe = files.find((f) => f.toLowerCase().endsWith(".exe") && !f.toLowerCase().includes("elevate"));
            if (exe) { foundDir = cand; templatePath = path.join(cand, exe); break; }
          }
          if (!foundDir) {
            return res.status(500).json({ success: false, message: `Build completed but no EXE found in ${frontendPath}/dist. Check electron-builder output.` });
          }
        } catch (e: any) {
          console.error("Kiosk build failed:", e?.stdout || e?.stderr || e?.message || e);
          return res.status(500).json({ success: false, message: "Failed to build kiosk on server. Check server logs." });
        }
      }

      console.log(`[kiosk.build] templatePath=${templatePath} buildOnServer=${buildOnServer}`);
      if (!fs.existsSync(templatePath)) {
        console.error(`[kiosk.build] template not found: ${templatePath}`);
        return res.status(503).json({
          success: false,
          message: `Kiosk template not found at ${templatePath}. ` +
            `Copy the entire win-unpacked folder to the server and set KIOSK_TEMPLATE_PATH to the EXE path inside it, ` +
            `e.g. /home/giga/queue/templates/win-unpacked/Qubit QMS Kiosk.exe`,
        });
      }

      // templateDir = the win-unpacked folder that contains the EXE and all Electron runtime files
      const templateDir = path.dirname(templatePath);
      const exeName = path.basename(templatePath);

      // Build the custom config
      const config = {
        kioskUrl: kioskUrl || "",
        apiUrl: apiUrl || "",
        printerName: printerName || null,
        deviceId: deviceId || null,
        apiToken: apiToken || null,
        fullscreen: fullscreen ?? true,
      };

      if (!archiver) {
        console.error("[kiosk.build] missing archiver dependency");
        return res.status(503).json({ success: false, message: 'Server missing dependency "archiver". Run `npm install` in starter.' });
      }

      const zipName = `qubit-kiosk-${Date.now()}.zip`;
      const zipPath = path.join(os.tmpdir(), zipName);

      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 1 } }); // level 1 = fastest, EXE is already compressed

        output.on("close", () => resolve());
        archive.on("error", (err: Error) => reject(err));
        archive.pipe(output);

        // Include EVERYTHING from the win-unpacked directory so Electron has all
        // the runtime files it needs (v8_context_snapshot.bin, snapshot_blob.bin,
        // icudtl.dat, DLLs, locales/, resources/, etc.).
        // Files land at the root of the ZIP (no subfolder), so the user just extracts
        // the ZIP, double-clicks the EXE and it works.
        archive.directory(templateDir + path.sep, false);

        // Override kiosk-config.json with the device-specific settings.
        // archiver appends entries in order; the last entry with a given name wins.
        const configBuf = Buffer.from(JSON.stringify(config, null, 2));
        archive.append(configBuf, { name: "kiosk-config.json" });

        archive.finalize();
      });

      const zipStat = fs.statSync(zipPath);
      console.log(`[kiosk.build] created zip ${zipPath} size=${zipStat.size} bytes`);

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="qubit-kiosk-${(deviceId || "setup").slice(0, 8)}.zip"`);
      res.sendFile(zipPath, (err) => {
        try { fs.unlinkSync(zipPath); } catch { /* ignore */ }
        if (err) console.error("[kiosk.build] Failed to send kiosk zip:", err);
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: (err as Error).message || "Failed to build kiosk" });
    }
  }
}

export default KioskController;
