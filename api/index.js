// Vercel serverless entry point: registers tsx loader for TypeScript server.ts support
import 'tsx/esm';
import app from '../server.ts';

export const config = { maxDuration: 60 };

export default app;
