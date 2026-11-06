// Vercel serverless entry point.
// NOTE: Vercel compiles server.ts to server.js, and in an ESM project ("type": "module")
// imports must name the compiled file. Importing '../server.ts' fails at runtime with
// ERR_MODULE_NOT_FOUND (/var/task/server.ts).
import app from '../server.js';

export const config = { maxDuration: 60 };

export default app;
