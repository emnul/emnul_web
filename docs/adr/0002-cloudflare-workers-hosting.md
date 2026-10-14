# Host on Cloudflare Workers

The site is deployed to Cloudflare Workers (static assets plus `@astrojs/cloudflare` for the few on-demand routes), built and previewed by Workers Builds from the git repo. The emnul.dev domain already lives on Cloudflare, the free tier covers the traffic, commercial use is allowed, and Workers secrets plus the Cache API cover the GitHub activity endpoint's needs.

## Considered Options

- **Vercel**: best-in-class DX, but optimised for Next.js, requires pointing DNS away from Cloudflare's proxy, and the Hobby tier is non-commercial.
- **Railway**: container hosting suited to long-running servers and databases — reserved for separately deployed Projects that need a backend, overkill for this site.
