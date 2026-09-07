# Krijo24

Create RAFTY V1. Keep it extremely simple. Build a production-quality responsive SaaS UI for branded social post creation. Core flow: upload ONE image, enter a few details (Offer/Title, Destination, Business/Product, optional Price, optional Date/Month, optional Additional text), optionally select included services, optionally generate an AI caption, then Generate Post, preview, edit text, save, and download. One picture per post only.

Design: premium minimalist SaaS, white/light surfaces, violet/purple accents, tasteful gradients, blurred/glass overlays, rounded cards, subtle shadows, strong typography. Main Create page: left compact form, right large live 4:5 preview on desktop; stacked elegantly on mobile. Minimal navigation: Create, Posts, Templates, Brand, Settings. Mobile uses compact bottom navigation. No unnecessary text.

Critical product rule: templates control ALL visual layout. AI only creates/re-writes text. Do not let AI redesign layouts. Templates use dynamic placeholders such as title, destination, business, price, date, services, additional_text, image, logo. Build a small deterministic template system with a few polished example templates. Generated posts should often use modern gradients, blur, image overlays, and editorial compositions.

Business brand: simple logo, brand colors, font settings. Multi-tenant structure with Supabase-ready architecture and tenant isolation. Keep database simple. Do not implement social publishing, scheduling, billing, analytics, competitor research, team collaboration, video, multi-image posts, advanced admin, or other features not listed. Make primary interactions functional and use realistic demo content. This is the first implementation, so prioritize the Create workflow and polished responsive UX over breadth.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://poster-forge-craft.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5a3f77fc-1723-4fd4-b3a8-1d753f001fad).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
