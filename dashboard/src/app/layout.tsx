import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hydra | Hybrid Deep-Learning for NWM Streamflow Correction',
  description:
    'A compact 1-million parameter GRU-Transformer model achieving up to 27% RMSE improvement in streamflow predictions. Edge-deployable architecture (3.81 MB) for real-time hydrological forecasting in Appalachian watersheds.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-gray-950">
        {children}
      </body>
    </html>
  );
}
