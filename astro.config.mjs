// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

import node from '@astrojs/node';

const staticPages = new Set([
  'src/pages/about.astro',
  'src/pages/blog/[...slug].astro',
  'src/pages/index.astro',
  'src/pages/login.astro',
  'src/pages/portfolio.astro',
  'src/pages/rss.xml.js',
  'src/pages/signup.astro',
  'src/pages/watchlist.astro',
]);

/** @type {import('astro').AstroIntegration} */
const staticSitePrerender = {
  name: 'static-site-prerender',
  hooks: {
    'astro:route:setup'({ route }) {
      if (process.env.STATIC_SITE_BUILD === 'true' && staticPages.has(route.component)) {
        route.prerender = true;
      }
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: 'https://example.com',
  devToolbar: {
    enabled: false,
  },
  integrations: [mdx(), sitemap(), staticSitePrerender],

  fonts: [
      {
          provider: fontProviders.local(),
          name: 'Atkinson',
          cssVariable: '--font-atkinson',
          fallbacks: ['sans-serif'],
          options: {
              variants: [
                  {
                      src: ['./src/assets/fonts/atkinson-regular.woff'],
                      weight: 400,
                      style: 'normal',
                      display: 'swap',
                  },
                  {
                      src: ['./src/assets/fonts/atkinson-bold.woff'],
                      weight: 700,
                      style: 'normal',
                      display: 'swap',
                  },
              ],
          },
      },
	],
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
});