import {existsSync} from 'node:fs';
if(process.env.OMNIFORM_DESKTOP_ENV_FILE&&existsSync(process.env.OMNIFORM_DESKTOP_ENV_FILE))process.loadEnvFile(process.env.OMNIFORM_DESKTOP_ENV_FILE);
await import('../server.mjs');
