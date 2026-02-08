'use client';

import { motion } from 'framer-motion';

interface SiteMarker {
  id: string;
  name: string;
  shortName: string;
  type: string;
  lat: number;
  lon: number;
  watershed: string;
}

const STUDY_SITES: SiteMarker[] = [
  {
    id: '03161000',
    name: 'South Fork New River near Jefferson, NC',
    shortName: 'Jefferson',
    type: 'mid-basin',
    lat: 36.4003,
    lon: -81.4206,
    watershed: 'New River',
  },
  {
    id: '03164000',
    name: 'New River near Galax, VA',
    shortName: 'Galax',
    type: 'mainstem',
    lat: 36.6456,
    lon: -80.9272,
    watershed: 'New River',
  },
  {
    id: '03479000',
    name: 'Watauga River near Sugar Grove, NC',
    shortName: 'Sugar Grove',
    type: 'headwaters',
    lat: 36.2367,
    lon: -81.8289,
    watershed: 'Watauga',
  },
];

// Map bounds for the study region (Appalachian NC/VA/TN border region)
const MAP_BOUNDS = {
  minLat: 35.8,
  maxLat: 37.0,
  minLon: -82.5,
  maxLon: -80.5,
};

function latLonToSvg(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * 100;
  const y = ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100;
  return { x, y };
}

export default function StudyRegionMap() {
  return (
    <div className="surface-panel rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-[#22384b]">
        <h2 className="font-display text-xl text-white">Study Region</h2>
        <p className="text-sm text-[#8fb4cc] mt-1">
          Southern Appalachian headwaters in NC, VA, and TN
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-0">
        {/* Map Section */}
        <div className="p-6 bg-[#0a1a26]">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-auto rounded-lg border border-[#2f465a]"
            style={{ maxHeight: '320px' }}
            role="img"
            aria-label="Map of study sites in the Southern Appalachian region"
          >
            {/* Background */}
            <rect x="0" y="0" width="100" height="100" fill="#0c1b2a" />

            {/* Simplified state boundaries */}
            <path
              d="M 5 45 Q 25 35, 50 40 T 95 50"
              stroke="#2f465a"
              strokeWidth="0.5"
              fill="none"
              strokeDasharray="2,2"
            />
            <path
              d="M 0 65 Q 40 55, 70 60 T 100 55"
              stroke="#2f465a"
              strokeWidth="0.5"
              fill="none"
              strokeDasharray="2,2"
            />

            {/* State labels */}
            <text x="75" y="25" fill="#4a6a80" fontSize="5" fontFamily="system-ui">
              VA
            </text>
            <text x="40" y="55" fill="#4a6a80" fontSize="5" fontFamily="system-ui">
              NC
            </text>
            <text x="10" y="75" fill="#4a6a80" fontSize="5" fontFamily="system-ui">
              TN
            </text>

            {/* Rivers - New River and Watauga */}
            <path
              d="M 35 85 Q 45 70, 55 55 Q 65 40, 85 20"
              stroke="#3b82f6"
              strokeWidth="1.5"
              fill="none"
              opacity="0.6"
            />
            <path
              d="M 10 60 Q 25 55, 40 65"
              stroke="#3b82f6"
              strokeWidth="1"
              fill="none"
              opacity="0.5"
            />

            {/* River labels */}
            <text x="70" y="35" fill="#3b82f6" fontSize="3.5" fontFamily="system-ui" opacity="0.8">
              New River
            </text>
            <text x="15" y="52" fill="#3b82f6" fontSize="3" fontFamily="system-ui" opacity="0.7">
              Watauga R.
            </text>

            {/* Blue Ridge annotation */}
            <text
              x="50"
              y="92"
              fill="#6b8a9e"
              fontSize="3"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              Blue Ridge Mountains
            </text>

            {/* Site markers */}
            {STUDY_SITES.map((site, index) => {
              const pos = latLonToSvg(site.lat, site.lon);
              return (
                <motion.g
                  key={site.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + index * 0.15, duration: 0.4 }}
                >
                  {/* Pulse ring */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="4"
                    fill="none"
                    stroke="#2be3d6"
                    strokeWidth="0.5"
                    opacity="0.4"
                  >
                    <animate
                      attributeName="r"
                      values="3;6;3"
                      dur="3s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.4;0.1;0.4"
                      dur="3s"
                      repeatCount="indefinite"
                    />
                  </circle>

                  {/* Main marker */}
                  <circle cx={pos.x} cy={pos.y} r="3" fill="#2be3d6" />
                  <circle cx={pos.x} cy={pos.y} r="1.5" fill="#0c1b2a" />

                  {/* Label */}
                  <text
                    x={pos.x + (pos.x > 50 ? -2 : 5)}
                    y={pos.y + (pos.y > 50 ? -4 : 1)}
                    fill="#e0f0f8"
                    fontSize="3.5"
                    fontFamily="system-ui"
                    textAnchor={pos.x > 50 ? 'end' : 'start'}
                  >
                    {site.shortName}
                  </text>
                  <text
                    x={pos.x + (pos.x > 50 ? -2 : 5)}
                    y={pos.y + (pos.y > 50 ? -1 : 4)}
                    fill="#8fb4cc"
                    fontSize="2.5"
                    fontFamily="system-ui"
                    textAnchor={pos.x > 50 ? 'end' : 'start'}
                  >
                    {site.type}
                  </text>
                </motion.g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            {STUDY_SITES.map((site) => (
              <div key={site.id} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-hydra-corrected" />
                <span className="text-[#a9c2d3]">
                  {site.shortName} ({site.watershed})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Context Section */}
        <div className="p-6 space-y-5">
          {/* Biome & Climate */}
          <div>
            <h3 className="font-display text-sm uppercase tracking-[0.14em] text-hydra-accent mb-2">
              Southern Appalachian Biome
            </h3>
            <p className="text-sm text-[#a9c2d3] leading-relaxed">
              The study region spans the Blue Ridge physiographic province, characterized by
              temperate deciduous forests, steep terrain, and high annual precipitation
              (1,200-2,000 mm). This creates flashy, responsive watersheds where streamflow
              can change rapidly during storm events.
            </p>
          </div>

          {/* Weather Patterns */}
          <div>
            <h3 className="font-display text-sm uppercase tracking-[0.14em] text-hydra-accent mb-2">
              Hydrometeorological Regime
            </h3>
            <p className="text-sm text-[#a9c2d3] leading-relaxed">
              The region experiences orographic enhancement of precipitation, with the
              Blue Ridge escarpment forcing moist air upward. Tropical remnants and
              atmospheric rivers can produce extreme rainfall, while baseflow is sustained
              by fractured bedrock aquifers.
            </p>
          </div>

          {/* Hurricane Helene Motivation */}
          <div className="p-4 rounded-xl bg-[#122334] border border-hydra-accent/20">
            <h3 className="font-display text-sm uppercase tracking-[0.14em] text-hydra-alert mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Research Motivation: Hurricane Helene
            </h3>
            <p className="text-sm text-[#a9c2d3] leading-relaxed">
              Hurricane Helene (September 2024) devastated this region, with catastrophic
              flooding in western North Carolina causing over 200 deaths and billions in
              damages. NWM forecasts significantly underestimated peak flows during this
              event. This research aims to improve streamflow predictions in mountainous
              terrain where operational models struggle most, potentially enabling better
              early warnings for future extreme events.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
