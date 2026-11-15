import { existsSync } from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const backendDirectory = path.resolve(__dirname, "../backend");
const backendPythonCandidates = process.platform === "win32"
  ? [path.join(backendDirectory, ".venv", "Scripts", "python.exe")]
  : [path.join(backendDirectory, ".venv", "bin", "python")];
const backendPythonPath = process.env.ARES_BACKEND_PYTHON
  ?? backendPythonCandidates.find((candidate) => existsSync(candidate))
  ?? "python";
const backendCommand = process.env.ARES_BACKEND_COMMAND
  ?? `${backendPythonPath.includes(" ") ? `"${backendPythonPath}"` : backendPythonPath} -m uvicorn app.main:app --host 127.0.0.1 --port 8000`;
const systemChromePath = process.platform === "win32"
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : undefined;
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ?? (systemChromePath && existsSync(systemChromePath) ? systemChromePath : undefined);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    launchOptions: chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: backendCommand,
      cwd: backendDirectory,
      url: "http://127.0.0.1:8000/api/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm dev",
      cwd: __dirname,
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
