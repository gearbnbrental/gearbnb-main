import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The modules under test transitively import src/supabase.ts, which constructs a client at
    // import time. These are placeholders so the import resolves without a real project — no test
    // here performs any network call.
    env: {
      VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'placeholder-anon-key',
    },
  },
});
