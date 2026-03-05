import { defineConfig } from 'astro/config';
import node from '@astrojs/node'; // Pastikan sudah install adapter node

import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server', // Ubah dari 'static' ke 'server'
  adapter: vercel(),
});