'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { FeatureCollection, Feature, Geometry } from 'geojson';

/* ---------- Types ---------- */
interface SiteMarker {
  id: string;
  name: string;
  shortName: string;
  type: string;
  lat: number;
  lon: number;
  watershed: string;
}

interface GeoData {
  states: FeatureCollection | null;
  rivers: FeatureCollection | null;
  watersheds: FeatureCollection | null;
}

/* ---------- Constants ---------- */
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

const MAP_BOUNDS = {
  minLat: 35.8,
  maxLat: 37.0,
  minLon: -82.5,
  maxLon: -80.5,
};

const STATE_FILLS: Record<string, string> = {
  VA: '#112538',
  NC: '#0f2233',
  TN: '#0d1f2e',
};

const STATE_LABELS = [
  { name: 'Virginia', lon: -81.0, lat: 36.85 },
  { name: 'North Carolina', lon: -81.4, lat: 36.05 },
  { name: 'Tennessee', lon: -82.35, lat: 36.30 },
];

const RIVER_LABELS = [
  { name: 'New River', lon: -80.85, lat: 36.75, rotation: -25 },
  { name: 'Watauga R.', lon: -82.10, lat: 36.18, rotation: 8 },
];

/* ---------- Custom Hooks ---------- */
function useGeoData(): GeoData & { loading: boolean } {
  const [data, setData] = useState<GeoData>({
    states: null,
    rivers: null,
    watersheds: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/data/geo/states.geojson').then((r) => r.json()),
      fetch('/data/geo/rivers.geojson').then((r) => r.json()),
      fetch('/data/geo/watersheds.geojson').then((r) => r.json()),
    ])
      .then(([states, rivers, watersheds]) => {
        setData({ states, rivers, watersheds });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { ...data, loading };
}

/* ---------- Mercator Projection (no d3-geo dependency) ---------- */
function mercatorY(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

interface Projection {
  (coords: [number, number]): [number, number];
}

function createProjection(width: number, height: number, padding: number): Projection {
  const minX = MAP_BOUNDS.minLon;
  const maxX = MAP_BOUNDS.maxLon;
  const minY = mercatorY(MAP_BOUNDS.minLat);
  const maxY = mercatorY(MAP_BOUNDS.maxLat);

  const drawW = width - padding * 2;
  const drawH = height - padding * 2;
  const scaleX = drawW / (maxX - minX);
  const scaleY = drawH / (maxY - minY);
  const scale = Math.min(scaleX, scaleY);

  const offsetX = padding + (drawW - (maxX - minX) * scale) / 2;
  const offsetY = padding + (drawH - (maxY - minY) * scale) / 2;

  return ([lon, lat]: [number, number]) => {
    const x = offsetX + (lon - minX) * scale;
    const y = offsetY + (maxY - mercatorY(lat)) * scale;
    return [x, y];
  };
}

function coordsToSvgPath(coords: number[][], proj: Projection): string {
  return coords
    .map(([lon, lat], i) => {
      const [x, y] = proj([lon, lat]);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join('');
}

function featureToPath(feature: Feature<Geometry>, proj: Projection): string {
  const geom = feature.geometry;
  if (geom.type === 'Polygon') {
    return geom.coordinates
      .map((ring) => coordsToSvgPath(ring, proj) + 'Z')
      .join('');
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates
      .map((polygon) => polygon.map((ring) => coordsToSvgPath(ring, proj) + 'Z').join(''))
      .join('');
  }
  if (geom.type === 'LineString') {
    return coordsToSvgPath(geom.coordinates, proj);
  }
  if (geom.type === 'MultiLineString') {
    return geom.coordinates.map((line) => coordsToSvgPath(line, proj)).join('');
  }
  return '';
}

function useProjection(width: number, height: number) {
  return useMemo(() => {
    if (width === 0 || height === 0) return { projection: null, pathGenerator: null };
    const projection = createProjection(width, height, 12);
    const pathGenerator = (feature: Feature<Geometry>) => featureToPath(feature, projection);
    return { projection, pathGenerator };
  }, [width, height]);
}

/* ---------- Component ---------- */
export default function StudyRegionMap() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 370 });
  const { states, rivers, watersheds, loading } = useGeoData();
  const { projection, pathGenerator } = useProjection(dimensions.width, dimensions.height);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width || 500;
      setDimensions({ width: w, height: Math.max(280, Math.min(w * 0.7, 380)) });
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

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
        <div className="p-4 lg:p-6 bg-[#0a1a26] min-h-[300px]" ref={wrapperRef}>
          {loading || !projection || !pathGenerator ? (
            <div
              className="w-full rounded-lg border border-[#2f465a] bg-[#0c1b2a] animate-pulse flex items-center justify-center"
              style={{ height: dimensions.height }}
            >
              <span className="text-[#4a6a80] text-sm">Loading map data...</span>
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
              className="w-full rounded-lg border border-[#2f465a]"
              style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
              role="img"
              aria-label="Map of study sites in the Southern Appalachian region"
            >
              {/* Background */}
              <rect width="100%" height="100%" fill="#0c1b2a" />

              {/* Layer 1: State fills */}
              {states?.features.map((feature: Feature<Geometry>, i: number) => (
                <path
                  key={`state-fill-${i}`}
                  d={pathGenerator(feature) || ''}
                  fill={STATE_FILLS[feature.properties?.name] || '#0f2233'}
                  stroke="none"
                />
              ))}

              {/* Layer 2: Watershed boundaries */}
              {watersheds?.features.map((feature: Feature<Geometry>, i: number) => (
                <path
                  key={`ws-${i}`}
                  d={pathGenerator(feature) || ''}
                  fill="#2be3d6"
                  fillOpacity={0.05}
                  stroke="#2be3d6"
                  strokeWidth={0.8}
                  strokeOpacity={0.25}
                  strokeDasharray="4,3"
                />
              ))}

              {/* Layer 3: Rivers */}
              {rivers?.features.map((feature: Feature<Geometry>, i: number) => {
                const order = feature.properties?.order ?? 3;
                return (
                  <path
                    key={`river-${i}`}
                    d={pathGenerator(feature) || ''}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={order >= 4 ? 2 : 1.2}
                    strokeOpacity={order >= 4 ? 0.65 : 0.45}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}

              {/* Layer 4: State boundary strokes */}
              {states?.features.map((feature: Feature<Geometry>, i: number) => (
                <path
                  key={`state-stroke-${i}`}
                  d={pathGenerator(feature) || ''}
                  fill="none"
                  stroke="#2f465a"
                  strokeWidth={1}
                />
              ))}

              {/* Layer 5: State labels */}
              {STATE_LABELS.map((label) => {
                const pt = projection([label.lon, label.lat]);
                if (!pt) return null;
                return (
                  <text
                    key={label.name}
                    x={pt[0]}
                    y={pt[1]}
                    fill="#4a6a80"
                    fontSize={label.name.length > 5 ? 10 : 13}
                    fontFamily="system-ui"
                    textAnchor="middle"
                    style={{ fontStyle: 'italic' }}
                  >
                    {label.name}
                  </text>
                );
              })}

              {/* Layer 6: River labels */}
              {RIVER_LABELS.map((label) => {
                const pt = projection([label.lon, label.lat]);
                if (!pt) return null;
                return (
                  <text
                    key={label.name}
                    x={pt[0]}
                    y={pt[1]}
                    fill="#3b82f6"
                    fontSize={9}
                    fontFamily="system-ui"
                    textAnchor="middle"
                    opacity={0.7}
                    transform={`rotate(${label.rotation}, ${pt[0]}, ${pt[1]})`}
                  >
                    {label.name}
                  </text>
                );
              })}

              {/* Layer 7: Blue Ridge annotation */}
              {(() => {
                const pt = projection([-81.5, 35.88]);
                if (!pt) return null;
                return (
                  <text
                    x={pt[0]}
                    y={pt[1]}
                    fill="#6b8a9e"
                    fontSize={9}
                    fontFamily="system-ui"
                    textAnchor="middle"
                  >
                    Blue Ridge Mountains
                  </text>
                );
              })()}

              {/* Layer 8: Site markers */}
              {STUDY_SITES.map((site, index) => {
                const pt = projection([site.lon, site.lat]);
                if (!pt) return null;
                const [x, y] = pt;
                const labelRight = x < dimensions.width * 0.6;
                const labelX = labelRight ? x + 10 : x - 10;
                const anchor = labelRight ? 'start' : 'end';

                return (
                  <motion.g
                    key={site.id}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + index * 0.15, duration: 0.4 }}
                  >
                    {/* Pulse ring */}
                    <circle
                      cx={x}
                      cy={y}
                      r="8"
                      fill="none"
                      stroke="#2be3d6"
                      strokeWidth="0.8"
                      opacity="0.4"
                    >
                      <animate
                        attributeName="r"
                        values="6;12;6"
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
                    <circle cx={x} cy={y} r="5" fill="#2be3d6" />
                    <circle cx={x} cy={y} r="2.5" fill="#0c1b2a" />

                    {/* Label background */}
                    <rect
                      x={labelRight ? labelX - 2 : labelX - 68}
                      y={y - 14}
                      width={70}
                      height={22}
                      fill="#0c1b2a"
                      fillOpacity={0.7}
                      rx={3}
                    />

                    {/* Label text */}
                    <text
                      x={labelX}
                      y={y - 3}
                      fill="#e0f0f8"
                      fontSize={11}
                      fontFamily="system-ui"
                      fontWeight="500"
                      textAnchor={anchor}
                    >
                      {site.shortName}
                    </text>
                    <text
                      x={labelX}
                      y={y + 8}
                      fill="#8fb4cc"
                      fontSize={8}
                      fontFamily="system-ui"
                      textAnchor={anchor}
                    >
                      {site.type}
                    </text>
                  </motion.g>
                );
              })}
            </svg>
          )}

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
        <div className="p-4 lg:p-6 space-y-5">
          {/* Study Sites Overview */}
          <div>
            <p className="text-sm text-[#a9c2d3] leading-relaxed">
              Three unregulated USGS gauging stations in the southern Appalachian highlands,
              spanning the New River and Watauga River basins in Virginia and North Carolina.
            </p>
            <div className="grid grid-cols-1 gap-2 mt-3 sm:grid-cols-3">
              {[
                { id: '03161000', name: 'Jefferson', river: 'S. Fork New River' },
                { id: '03164000', name: 'Galax', river: 'New River' },
                { id: '03479000', name: 'Sugar Grove', river: 'Watauga River' },
              ].map((site) => (
                <div
                  key={site.id}
                  className="rounded-lg bg-[#0c1a26] border border-[#264257] p-2.5 text-center"
                >
                  <div className="text-sm font-medium text-white">{site.name}</div>
                  <div className="text-xs text-[#8fb4cc] mt-0.5">{site.river}</div>
                  <div className="text-xs text-[#6f8da0] mt-1 font-mono">{site.id}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#8fb4cc] mt-3">
              Mixed deciduous-coniferous forest at 500–1400 m elevation. Humid subtropical climate
              with orographic precipitation enhancement. Study period: 2010–2020 (hourly).
            </p>
          </div>

          {/* Biome & Climate */}
          <div>
            <h3 className="font-display text-sm uppercase tracking-[0.14em] text-hydra-accent mb-2">
              Southern Appalachian Biome
            </h3>
            <p className="text-sm text-[#a9c2d3] leading-relaxed">
              The study region spans the Blue Ridge physiographic province, characterized by
              temperate deciduous forests, steep terrain, and high annual precipitation
              (1,200-2,000 mm). This creates flashy, responsive watersheds where streamflow can
              change rapidly during storm events.
            </p>
          </div>

          {/* Weather Patterns */}
          <div>
            <h3 className="font-display text-sm uppercase tracking-[0.14em] text-hydra-accent mb-2">
              Hydrometeorological Regime
            </h3>
            <p className="text-sm text-[#a9c2d3] leading-relaxed">
              The region experiences orographic enhancement of precipitation, with the Blue Ridge
              escarpment forcing moist air upward. Tropical remnants and atmospheric rivers can
              produce extreme rainfall, while baseflow is sustained by fractured bedrock aquifers.
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
              Hurricane Helene (September 2024) devastated this region, with catastrophic flooding
              in western North Carolina causing over 200 deaths and billions in damages. NWM
              forecasts significantly underestimated peak flows during this event. This research
              aims to improve streamflow predictions in mountainous terrain where operational
              models struggle most, potentially enabling better early warnings for future extreme
              events.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
