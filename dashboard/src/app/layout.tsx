import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hydra Experience | Many Signals. One Warning. More Time.',
  description:
    'Cinematic public education experience and evidence dashboard for Hydra, connecting flood timing, official safety guidance, local NWM correction, and ERA5 feature-sweep evidence.',
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
