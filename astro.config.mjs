import { defineConfig } from 'astro/config';
import node from '@astrojs/node'; // Pastikan sudah install adapter node

export default defineConfig({
  output: 'server', // Ubah dari 'static' ke 'server'
  adapter: node({
    mode: 'standalone',
  }),
});

