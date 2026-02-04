'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface ErrorDistributionProps {
  nwmErrors: number[];
  correctedErrors: number[];
  width?: number;
  height?: number;
}

export default function ErrorDistribution({
  nwmErrors,
  correctedErrors,
  width = 500,
  height = 300,
}: ErrorDistributionProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 30, right: 30, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Compute histogram bins
    const allErrors = [...nwmErrors, ...correctedErrors];
    const extent = d3.extent(allErrors) as [number, number];
    const xScale = d3
      .scaleLinear()
      .domain([extent[0] * 1.1, extent[1] * 1.1])
      .range([0, innerWidth]);

    const histogram = d3
      .bin()
      .domain(xScale.domain() as [number, number])
      .thresholds(30);

    const nwmBins = histogram(nwmErrors);
    const correctedBins = histogram(correctedErrors);

    const maxCount = Math.max(
      d3.max(nwmBins, (d) => d.length) || 0,
      d3.max(correctedBins, (d) => d.length) || 0
    );

    const yScale = d3.scaleLinear().domain([0, maxCount]).range([innerHeight, 0]);

    // Draw NWM histogram
    g.selectAll('.nwm-bar')
      .data(nwmBins)
      .join('rect')
      .attr('class', 'nwm-bar')
      .attr('x', (d) => xScale(d.x0!) + 1)
      .attr('y', (d) => yScale(d.length))
      .attr('width', (d) => Math.max(0, xScale(d.x1!) - xScale(d.x0!) - 2))
      .attr('height', (d) => innerHeight - yScale(d.length))
      .attr('fill', '#6b7280')
      .attr('opacity', 0.5);

    // Draw corrected histogram
    g.selectAll('.corrected-bar')
      .data(correctedBins)
      .join('rect')
      .attr('class', 'corrected-bar')
      .attr('x', (d) => xScale(d.x0!) + 1)
      .attr('y', (d) => yScale(d.length))
      .attr('width', (d) => Math.max(0, xScale(d.x1!) - xScale(d.x0!) - 2))
      .attr('height', (d) => innerHeight - yScale(d.length))
      .attr('fill', '#10b981')
      .attr('opacity', 0.5);

    // Zero line
    g.append('line')
      .attr('x1', xScale(0))
      .attr('x2', xScale(0))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,4');

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('fill', '#9ca3af');

    g.append('g').call(d3.axisLeft(yScale)).selectAll('text').attr('fill', '#9ca3af');

    // Labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .attr('fill', '#9ca3af')
      .text('Error (m³/s)');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -45)
      .attr('text-anchor', 'middle')
      .attr('fill', '#9ca3af')
      .text('Frequency');

    // Title
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#e5e7eb')
      .attr('font-weight', 'bold')
      .text('Error Distribution');

    // Legend
    const legend = g
      .append('g')
      .attr('transform', `translate(${innerWidth - 100}, 10)`);

    const legendItems = [
      { label: 'NWM', color: '#6b7280' },
      { label: 'Corrected', color: '#10b981' },
    ];

    legendItems.forEach((item, i) => {
      const legendGroup = legend
        .append('g')
        .attr('transform', `translate(0, ${i * 20})`);

      legendGroup
        .append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', item.color)
        .attr('opacity', 0.7);

      legendGroup
        .append('text')
        .attr('x', 20)
        .attr('y', 12)
        .attr('fill', '#e5e7eb')
        .attr('font-size', '12px')
        .text(item.label);
    });
  }, [nwmErrors, correctedErrors, width, height]);

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <svg ref={svgRef} width={width} height={height} className="w-full" />
    </div>
  );
}
