// Vercel serverless entry point: every /api/* request is handled by the same Express app that `npm start` runs locally.
import app from '../server.js';

export const config = { maxDuration: 60 };

export default app;
