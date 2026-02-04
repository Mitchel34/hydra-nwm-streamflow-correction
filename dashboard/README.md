# Hydra Dashboard

Interactive visualization dashboard for the Hydra Transformer NWM streamflow error correction thesis project.

## Features

- **Site Selection**: Compare results across 4 study sites in Watauga/New River watersheds
- **Experiment Comparison**: Toggle between model variants (LSTM, Hydra v1, Hydra v2, causal, physics-informed)
- **Interactive Hydrograph**: D3.js time series visualization with USGS, NWM, and corrected streamflow
- **Metrics Bar Charts**: Recharts comparison of RMSE, NSE, KGE, PBIAS improvements
- **Error Distribution**: Histogram overlay showing error reduction
- **Gradient Heatmap**: TensorBoard-style gradient visualization (when experiments include `--track-gradients`)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: D3.js + Recharts
- **Database**: Supabase (optional, falls back to local JSON)
- **Deployment**: Vercel-ready

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
