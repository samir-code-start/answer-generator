import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Injects process.env.API_KEY into the client-side bundle.
    // It will take the value of the API_KEY environment variable set during the build process (e.g., in Vercel).
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  build: {
    outDir: 'dist', // Default output directory for Vercel
  },
  server: {
    open: true, // Automatically open the browser on `npm run dev`
  },
});