'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TimeSeriesPoint } from '@/lib/types';

interface HydrographProps {
  data: TimeSeriesPoint[];
  height?: number;
  showConfidenceInterval?: boolean;
  experimentName?: string;
  siteName?: string;
}

const COLORS = {
  observed: '#f2b46a',
  baseline: '#7e94aa',
  corrected: '#2be3d6',
  confidence: '#2be3d6',
  grid: '#294559',
  axis: '#8ba9bc',
};

export default function Hydrograph({
  data,
  height = 420,
  showConfidenceInterval = true,
  experimentName,
  siteName,
}: HydrographProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [chartWidth, setChartWidth] = useState(820);

  useEffect(() => {
    if (!wrapperRef.current) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width || 820;
      setChartWidth(Math.max(320, width));
    });

    observer.observe(wrapperRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = {
      top: 18,
      right: chartWidth < 700 ? 20 : 150,
      bottom: 56,
      left: 62,
    };

    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const parsedData = data
      .map((point) => ({
        ...point,
        date: new Date(point.timestamp),
      }))
      .filter((point) => Number.isFinite(point.date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (parsedData.length === 0) {
      return;
    }

    const xScale = d3
      .scaleTime()
      .domain(d3.extent(parsedData, (d) => d.date) as [Date, Date])
      .range([0, innerWidth]);

    const yMax =
      d3.max(parsedData, (d) =>
        Math.max(d.usgs, d.nwm, d.corrected, d.upper_ci ?? d.corrected)
      ) || 1;

    const yScale = d3
      .scaleLinear()
      .domain([0, yMax * 1.12])
      .nice()
      .range([innerHeight, 0]);

    const root = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xTicks = chartWidth < 540 ? 4 : 7;
    const yTicks = chartWidth < 540 ? 4 : 6;

    root
      .append('g')
      .attr('class', 'grid-x')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(xTicks)
          .tickSize(-innerHeight)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', COLORS.grid)
      .attr('stroke-opacity', 0.45);

    root
      .append('g')
      .attr('class', 'grid-y')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(yTicks)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', COLORS.grid)
      .attr('stroke-opacity', 0.45);

    const xAxis = d3
      .axisBottom<Date>(xScale)
      .ticks(xTicks)
      .tickFormat(d3.timeFormat('%b %d'));

    const yAxis = d3.axisLeft(yScale).ticks(yTicks);

    root
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', COLORS.axis)
      .style('font-size', '11px');

    root
      .append('g')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', COLORS.axis)
      .style('font-size', '11px');

    root.selectAll('.domain, .tick line').attr('stroke', '#385468');

    root
      .append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 44)
      .attr('text-anchor', 'middle')
      .attr('fill', COLORS.axis)
      .style('font-size', '12px')
      .text('Date');

    root
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -45)
      .attr('text-anchor', 'middle')
      .attr('fill', COLORS.axis)
      .style('font-size', '12px')
      .text('Streamflow (m³/s)');

    if (showConfidenceInterval) {
      const confidenceArea = d3
        .area<(typeof parsedData)[number]>()
        .x((d) => xScale(d.date))
        .y0((d) => yScale(d.lower_ci ?? d.corrected))
        .y1((d) => yScale(d.upper_ci ?? d.corrected))
        .curve(d3.curveMonotoneX);

      root
        .append('path')
        .datum(parsedData)
        .attr('fill', COLORS.confidence)
        .attr('fill-opacity', 0.13)
        .attr('d', confidenceArea);
    }

    const line = (accessor: (d: (typeof parsedData)[number]) => number) =>
      d3
        .line<(typeof parsedData)[number]>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(accessor(d)))
        .curve(d3.curveMonotoneX);

    root
      .append('path')
      .datum(parsedData)
      .attr('fill', 'none')
      .attr('stroke', COLORS.baseline)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '8 5')
      .attr('d', line((d) => d.nwm));

    root
      .append('path')
      .datum(parsedData)
      .attr('fill', 'none')
      .attr('stroke', COLORS.observed)
      .attr('stroke-width', 2.2)
      .attr('d', line((d) => d.usgs));

    root
      .append('path')
      .datum(parsedData)
      .attr('fill', 'none')
      .attr('stroke', COLORS.corrected)
      .attr('stroke-width', 2.6)
      .attr('d', line((d) => d.corrected));

    const legendItems = [
      { label: 'Observed (USGS)', color: COLORS.observed, dashed: false },
      { label: 'Raw NWM', color: COLORS.baseline, dashed: true },
      { label: 'Hydra corrected', color: COLORS.corrected, dashed: false },
    ];

    const legendX = chartWidth < 700 ? 0 : innerWidth + 12;
    const legendY = chartWidth < 700 ? innerHeight + 18 : 8;

    const legend = root
      .append('g')
      .attr('transform', `translate(${legendX}, ${legendY})`);

    legendItems.forEach((item, index) => {
      const row = legend.append('g').attr('transform', `translate(0, ${index * 22})`);
      row
        .append('line')
        .attr('x1', 0)
        .attr('x2', 25)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', item.color)
        .attr('stroke-width', 2.3)
        .attr('stroke-dasharray', item.dashed ? '7 4' : 'none');

      row
        .append('text')
        .attr('x', 30)
        .attr('y', 4)
        .attr('fill', '#d8e7f1')
        .style('font-size', '12px')
        .text(item.label);
    });

    const focusLine = root
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#96b0c3')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-dasharray', '4 4')
      .style('display', 'none');

    const focusPoints = [COLORS.observed, COLORS.baseline, COLORS.corrected].map((color) =>
      root
        .append('circle')
        .attr('r', 3.5)
        .attr('fill', color)
        .attr('stroke', '#06121d')
        .attr('stroke-width', 1)
        .style('display', 'none')
    );

    const tooltip = d3
      .select('body')
      .append('div')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('pointer-events', 'none')
      .style('background', '#081622')
      .style('border', '1px solid #2e495f')
      .style('border-radius', '8px')
      .style('padding', '10px 12px')
      .style('font-size', '12px')
      .style('line-height', '1.45')
      .style('color', '#d8e7f1')
      .style('box-shadow', '0 10px 25px rgba(4, 12, 18, 0.55)');

    const bisector = d3.bisector<(typeof parsedData)[number], Date>((point) => point.date).left;

    root
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const x0 = xScale.invert(mx);
        const idx = bisector(parsedData, x0, 1);
        const left = parsedData[Math.max(0, idx - 1)];
        const right = parsedData[Math.min(parsedData.length - 1, idx)];
        const point =
          x0.getTime() - left.date.getTime() > right.date.getTime() - x0.getTime()
            ? right
            : left;

        const pointX = xScale(point.date);

        focusLine.attr('x1', pointX).attr('x2', pointX).style('display', null);

        focusPoints[0]
          .attr('cx', pointX)
          .attr('cy', yScale(point.usgs))
          .style('display', null);
        focusPoints[1]
          .attr('cx', pointX)
          .attr('cy', yScale(point.nwm))
          .style('display', null);
        focusPoints[2]
          .attr('cx', pointX)
          .attr('cy', yScale(point.corrected))
          .style('display', null);

        const baselineErr = point.nwm - point.usgs;
        const correctedErr = point.corrected - point.usgs;

        tooltip
          .style('visibility', 'visible')
          .style('left', `${event.pageX + 12}px`)
          .style('top', `${event.pageY - 18}px`)
          .html(
            [
              `<div style="font-weight:600; margin-bottom:4px;">${d3
                .timeFormat('%Y-%m-%d %H:%M')(point.date)}</div>`,
              experimentName ? `<div>Experiment: ${experimentName}</div>` : '',
              siteName ? `<div>Site: ${siteName}</div>` : '',
              `<div style="margin-top:4px; color:${COLORS.observed};">Observed: ${point.usgs.toFixed(2)} m³/s</div>`,
              `<div style="color:${COLORS.baseline};">NWM raw: ${point.nwm.toFixed(2)} m³/s</div>`,
              `<div style="color:${COLORS.corrected};">Hydra corrected: ${point.corrected.toFixed(2)} m³/s</div>`,
              `<div style="margin-top:4px;">Baseline error: ${baselineErr.toFixed(2)} m³/s</div>`,
              `<div>Corrected error: ${correctedErr.toFixed(2)} m³/s</div>`,
            ]
              .filter(Boolean)
              .join('')
          );
      })
      .on('mouseleave', () => {
        focusLine.style('display', 'none');
        focusPoints.forEach((point) => point.style('display', 'none'));
        tooltip.style('visibility', 'hidden');
      });

    return () => {
      tooltip.remove();
    };
  }, [chartWidth, data, experimentName, height, showConfidenceInterval, siteName]);

  return (
    <div className="rounded-xl border border-[#2a4558] bg-[#0a1a27] p-4">
      {data.length === 0 ? (
        <div className="flex h-[340px] items-center justify-center text-sm text-[#92b0c5]">
          Time series not available for the current selection.
        </div>
      ) : (
        <div ref={wrapperRef} className="w-full">
          <svg
            ref={svgRef}
            width={chartWidth}
            height={height}
            className="w-full"
            role="img"
            aria-label="Hydrograph comparing observed, NWM raw, and Hydra-corrected streamflow"
          />
        </div>
      )}
    </div>
  );
}
