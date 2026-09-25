// Shared test setup. Tests run from the test/ folder: `node soak.mjs` (after `npm install` in the project root)
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
export const ROOT = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep).href; // file:///.../seedfall/
export const HTTP = process.env.SEEDFALL_HTTP || 'http://localhost:8765/'; // some tests need a server: `npm run serve`
export const launch = () => chromium.launch({ headless: true, ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
