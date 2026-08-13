import { Request, Response } from "express";
import fs from "fs";
import os from "os";
import path from "path";
// Load archiver at runtime to avoid TypeScript compile-time module resolution
const archiver = (() => {
  try {
    // use eval to prevent static analysis from requiring the module at compile time
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

      let templatePath = process.env.KIOSK_TEMPLATE_PATH || path.join(process.cwd(), "templates", "Qubit QMS Kiosk.exe");

      if (buildOnServer) {
        // Attempt to build the frontend + electron package on the server
        const frontendPath = process.env.FRONTEND_PATH || path.join(process.cwd(), "..", "queue_front");
        try {
          // Install deps and build
          await exec("npm ci", { cwd: frontendPath, timeout: 20 * 60 * 1000 });
          await exec("npm run build", { cwd: frontendPath, timeout: 10 * 60 * 1000 });
          // Pack electron (produces a portable exe via electron-builder)
          await exec("npm run electron:pack", { cwd: frontendPath, timeout: 10 * 60 * 1000 });

          // Try to locate produced exe in standard dist locations
          const candidates = [
            path.join(frontendPath, "dist"),
            path.join(frontendPath, "dist", "win-unpacked"),
            path.join(frontendPath, "dist", "portable"),
            path.join(frontendPath, "release"),
          ];
          let found: string | null = null;
          for (const cand of candidates) {
            if (!fs.existsSync(cand)) continue;
            const files = fs.readdirSync(cand);
            const exe = files.find((f) => f.toLowerCase().endsWith(".exe"));
            if (exe) {
              found = path.join(cand, exe);
              break;
            }
            // check nested folder
            for (const f of files) {
              const sub = path.join(cand, f);
              if (fs.statSync(sub).isDirectory()) {
                const subfiles = fs.readdirSync(sub);
                const exe2 = subfiles.find((s) => s.toLowerCase().endsWith(".exe"));
                if (exe2) { found = path.join(sub, exe2); break; }
              }
            }
            if (found) break;
          }
          if (found) {
            templatePath = found;
          } else {
            return res.status(500).json({ success: false, message: `Build completed but no EXE found in ${frontendPath}/dist. Check electron-builder output.` });
          }
        } catch (e: any) {
          console.error("Kiosk build failed:", e?.stdout || e?.stderr || e?.message || e);
          return res.status(500).json({ success: false, message: "Failed to build kiosk on server. Check server logs." });
        }
      }

      if (!fs.existsSync(templatePath)) {
        return res.status(503).json({ success: false, message: `Kiosk template not found at ${templatePath}. Place the built EXE there or set KIOSK_TEMPLATE_PATH.` });
      }

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kiosk-"));
      const exeName = path.basename(templatePath);
      const exeDest = path.join(tmpDir, exeName);
      fs.copyFileSync(templatePath, exeDest);

      const config = {
        kioskUrl: kioskUrl || "",
        apiUrl: apiUrl || "",
        printerName: printerName || null,
        deviceId: deviceId || null,
        apiToken: apiToken || null,
        fullscreen: fullscreen ?? true,
      };

      const configPath = path.join(tmpDir, "kiosk-config.json");
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const zipName = `qubit-kiosk-${Date.now()}.zip`;
      const zipPath = path.join(os.tmpdir(), zipName);

      if (!archiver) {
        return res.status(503).json({ success: false, message: 'Server missing dependency "archiver". Run `npm install` in starter.' });
      }

      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });
        output.on("close", () => resolve());
        archive.on("error", (err: Error) => reject(err));
        archive.pipe(output);
        archive.file(exeDest, { name: exeName });
        archive.file(configPath, { name: "kiosk-config.json" });
        archive.finalize();
      });

      res.download(zipPath, zipName, (err) => {
        try {
          fs.unlinkSync(zipPath);
          fs.unlinkSync(exeDest);
          fs.unlinkSync(configPath);
          fs.rmdirSync(tmpDir);
        } catch { /* ignore cleanup errors */ }
        if (err) {
          console.error("Failed to send kiosk zip:", err);
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: (err as Error).message || "Failed to build kiosk" });
    }
  }
}

export default KioskController;
