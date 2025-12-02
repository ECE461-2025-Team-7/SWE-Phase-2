import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "0.0.0.0",
    allowedHosts: ".compute-1.amazonaws.com",
    proxy: {
      '/authenticate': 'http://localhost:3100',
      '/health': 'http://localhost:3100',
      '/artifact': 'http://localhost:3100',
      '/artifacts': 'http://localhost:3100',
      '/tracks': 'http://localhost:3100',
      '/reset': 'http://localhost:3100',
    }
  }
});
