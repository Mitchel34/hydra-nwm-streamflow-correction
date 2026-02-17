'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface ErrorDistributionProps {
  nwmErrors: number[];
  correctedErrors: number[];
  height?: number;
  baselineLabel?: string;
}

const COLORS = {
  baseline: '#7e94aa',
  corrected: '#2be3d6',
  axis: '#8ba9bc',
  grid: '#2b465a',
  zero: '#f2b46a',
};

export default function ErrorDistribution({
  nwmErrors,
  correctedErrors,
  height = 300,
  baselineLabel = 'NWM baseline',
}: ErrorDistributionProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [chartWidth, setChartWidth] = useState(520);

  useEffect(() => {
    if (!wrapperRef.current) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width || 520;
      setChartWidth(Math.max(320, width));
    });

    observer.observe(wrapperRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const hasData = nwmErrors.length > 0 && correctedErrors.length > 0;
    if (!hasData) {
      return;
    }

    const margin = { top: 20, right: 18, bottom: 52, left: 56 };
    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxAbs =
      d3.max([...nwmErrors, ...correctedErrors], (value) => Math.abs(value)) || 1;

    const xScale = d3
      .scaleLinear()
      .domain([-maxAbs * 1.1, maxAbs * 1.1])
      .range([0, innerWidth]);

    const histogram = d3
      .bin<number, number>()
      .domain(xScale.domain() as [number, number])
      .thresholds(26);

    const nwmBins = histogram(nwmErrors);
    const correctedBins = histogram(correctedErrors);

    const maxCount =
      Math.max(
        d3.max(nwmBins, (bin) => bin.length) || 0,
        d3.max(correctedBins, (bin) => bin.length) || 0
      ) * 1.12;

    const yScale = d3.scaleLinear().domain([0, maxCount]).nice().range([innerHeight, 0]);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(chartWidth < 460 ? 5 : 7)
          .tickSizeOuter(0)
      )
      .selectAll('text')
      .attr('fill', COLORS.axis)
      .style('font-size', '11px');

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(chartWidth < 460 ? 4 : 6).tickSizeOuter(0))
      .selectAll('text')
      .attr('fill', COLORS.axis)
      .style('font-size', '11px');

    g.selectAll('.domain, .tick line').attr('stroke', '#355368');

    g.append('g')
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
          .ticks(chartWidth < 460 ? 4 : 6)
      )
      .selectAll('line')
      .attr('stroke', COLORS.grid)
      .attr('stroke-opacity', 0.42);

    const tooltip = d3
      .select('body')
      .append('div')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('pointer-events', 'none')
      .style('background', '#081622')
      .style('border', '1px solid #2e495f')
      .style('border-radius', '8px')
      .style('padding', '8px 10px')
      .style('font-size', '12px')
      .style('color', '#d7e7f1');

    const showTooltip = (
      event: MouseEvent,
      label: string,
      bin: d3.Bin<number, number>
    ) => {
      tooltip
        .style('visibility', 'visible')
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY - 18}px`)
        .html(
          `<div style="font-weight:600; margin-bottom:3px;">${label}</div><div>Error range: ${
            bin.x0?.toFixed(2) || '0'
          } to ${bin.x1?.toFixed(2) || '0'} m³/s</div><div>Count: ${bin.length}</div>`
        );
    };

    const hideTooltip = () => {
      tooltip.style('visibility', 'hidden');
    };

    g.selectAll('.bar-nwm')
      .data(nwmBins)
      .join('rect')
      .attr('class', 'bar-nwm')
      .attr('x', (bin) => xScale(bin.x0 ?? 0) + 1)
      .attr('y', (bin) => yScale(bin.length))
      .attr('width', (bin) => Math.max(0, xScale(bin.x1 ?? 0) - xScale(bin.x0 ?? 0) - 2))
      .attr('height', (bin) => innerHeight - yScale(bin.length))
      .attr('fill', COLORS.baseline)
      .attr('opacity', 0.45)
      .on('mousemove', function (event: MouseEvent, bin) {
        d3.select(this).attr('opacity', 0.65);
        showTooltip(event, `${baselineLabel} error`, bin);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('opacity', 0.45);
        hideTooltip();
      });

    g.selectAll('.bar-corrected')
      .data(correctedBins)
      .join('rect')
      .attr('class', 'bar-corrected')
      .attr('x', (bin) => xScale(bin.x0 ?? 0) + 1)
      .attr('y', (bin) => yScale(bin.length))
      .attr('width', (bin) => Math.max(0, xScale(bin.x1 ?? 0) - xScale(bin.x0 ?? 0) - 2))
      .attr('height', (bin) => innerHeight - yScale(bin.length))
      .attr('fill', COLORS.corrected)
      .attr('opacity', 0.45)
      .on('mousemove', function (event: MouseEvent, bin) {
        d3.select(this).attr('opacity', 0.65);
        showTooltip(event, 'Hydra corrected error', bin);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('opacity', 0.45);
        hideTooltip();
      });

    g.append('line')
      .attr('x1', xScale(0))
      .attr('x2', xScale(0))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', COLORS.zero)
      .attr('stroke-width', 1.7)
      .attr('stroke-dasharray', '5 4');

    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .attr('fill', COLORS.axis)
      .style('font-size', '12px')
      .text('Prediction Error (m³/s)');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -40)
      .attr('text-anchor', 'middle')
      .attr('fill', COLORS.axis)
      .style('font-size', '12px')
      .text('Frequency');

    const legend = g.append('g').attr('transform', `translate(${innerWidth - 140}, 8)`);

    [
      { label: baselineLabel, color: COLORS.baseline },
      { label: 'Hydra corrected', color: COLORS.corrected },
    ].forEach((item, i) => {
      const row = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
      row
        .append('rect')
        .attr('width', 14)
        .attr('height', 14)
        .attr('fill', item.color)
        .attr('opacity', 0.7);
      row
        .append('text')
        .attr('x', 20)
        .attr('y', 11)
        .attr('fill', '#d8e8f2')
        .style('font-size', '11px')
        .text(item.label);
    });

    return () => {
      tooltip.remove();
    };
  }, [baselineLabel, chartWidth, correctedErrors, height, nwmErrors]);

  const hasData = nwmErrors.length > 0 && correctedErrors.length > 0;

  return (
    <div className="rounded-xl border border-[#2a4558] bg-[#0a1a27] p-4">
      {!hasData ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-[#93b1c6]">
          Error distribution is unavailable until time-series values are loaded.
        </div>
      ) : (
        <div ref={wrapperRef} className="w-full">
          <svg
            ref={svgRef}
            width={chartWidth}
            height={height}
            className="w-full"
            role="img"
            aria-label="Histogram comparing baseline and corrected prediction errors"
          />
        </div>
      )}
    </div>
  );
}
