'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GradientData } from '@/lib/types';

interface GradientHeatmapProps {
  data: GradientData[];
  height?: number;
}

export default function GradientHeatmap({
  data,
  height = 300,
}: GradientHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  // Track container width responsively
  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(Math.floor(w));
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const width = containerWidth;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 30, right: 80, bottom: 50, left: 100 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Get unique epochs and layers
    const epochs = [...new Set(data.map((d) => d.epoch))].sort((a, b) => a - b);
    const layers = [...new Set(data.map((d) => d.layer))];

    // Scales
    const xScale = d3.scaleBand().domain(epochs.map(String)).range([0, innerWidth]).padding(0.05);
    const yScale = d3.scaleBand().domain(layers).range([0, innerHeight]).padding(0.05);

    // Color scale (log scale for gradients which can vary widely)
    const maxGrad = d3.max(data, (d) => d.mean_grad) || 1;
    const colorScale = d3
      .scaleSequential(d3.interpolateViridis)
      .domain([0, Math.log10(maxGrad + 1e-10)]);

    // Draw cells
    g.selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', (d) => xScale(String(d.epoch)) || 0)
      .attr('y', (d) => yScale(d.layer) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', (d) => colorScale(Math.log10(d.mean_grad + 1e-10)))
      .attr('rx', 2)
      .append('title')
      .text(
        (d) =>
          `Epoch ${d.epoch}, ${d.layer}\nMean: ${d.mean_grad.toExponential(2)}\nMax: ${d.max_grad.toExponential(2)}`
      );

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3.axisBottom(xScale).tickValues(
          epochs.filter((_, i) => i % 5 === 0).map(String)
        )
      )
      .selectAll('text')
      .attr('fill', '#9ca3af');

    // Y axis
    g.append('g').call(d3.axisLeft(yScale)).selectAll('text').attr('fill', '#9ca3af');

    // Axis labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .attr('fill', '#9ca3af')
      .text('Epoch');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -80)
      .attr('text-anchor', 'middle')
      .attr('fill', '#9ca3af')
      .text('Layer');

    // Title
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#e5e7eb')
      .attr('font-weight', 'bold')
      .text('Gradient Magnitude Heatmap');

    // Color legend
    const legendWidth = 20;
    const legendHeight = innerHeight;
    const legendScale = d3
      .scaleLinear()
      .domain([0, Math.log10(maxGrad + 1e-10)])
      .range([legendHeight, 0]);

    const legendAxis = d3
      .axisRight(legendScale)
      .ticks(5)
      .tickFormat((d) => (10 ** (d as number)).toExponential(0));

    const legendG = svg
      .append('g')
      .attr(
        'transform',
        `translate(${width - margin.right + 20},${margin.top})`
      );

    // Legend gradient
    const defs = svg.append('defs');
    const gradient = defs
      .append('linearGradient')
      .attr('id', 'gradient-legend')
      .attr('x1', '0%')
      .attr('x2', '0%')
      .attr('y1', '100%')
      .attr('y2', '0%');

    const nStops = 10;
    for (let i = 0; i <= nStops; i++) {
      const t = i / nStops;
      gradient
        .append('stop')
        .attr('offset', `${t * 100}%`)
        .attr(
          'stop-color',
          colorScale(t * Math.log10(maxGrad + 1e-10))
        );
    }

    legendG
      .append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'url(#gradient-legend)');

    legendG
      .append('g')
      .attr('transform', `translate(${legendWidth},0)`)
      .call(legendAxis)
      .selectAll('text')
      .attr('fill', '#9ca3af');
  }, [data, containerWidth, height]);

  return (
    <div ref={wrapperRef} className="bg-gray-900 rounded-lg p-4">
      <svg
        ref={svgRef}
        width={containerWidth}
        height={height}
        className="w-full"
      />
    </div>
  );
}
