import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hydra | Evidence for Local NWM Streamflow Correction',
  description:
    'Public companion dashboard for a Hydra streamflow-correction study, showing gauge-informed NWM correction, input-source ablations, and completed ERA5 feature-sweep evidence.',
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
