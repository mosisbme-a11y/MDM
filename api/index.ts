// Vercel serverless entry point
import app from '../server.ts';

export const config = { maxDuration: 60 };

export default app;
