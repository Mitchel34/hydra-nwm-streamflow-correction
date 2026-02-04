'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { TimeSeriesPoint } from '@/lib/types';

interface HydrographProps {
  data: TimeSeriesPoint[];
  width?: number;
  height?: number;
  showConfidenceInterval?: boolean;
}

export default function Hydrograph({
  data,
  width = 800,
  height = 400,
  showConfidenceInterval = true,
}: HydrographProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 120, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Parse timestamps
    const parseTime = d3.timeParse('%Y-%m-%dT%H:%M:%S.%LZ');
    const parsedData = data.map((d) => ({
      ...d,
      date: parseTime(d.timestamp) || new Date(d.timestamp),
    }));

    // Scales
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(parsedData, (d) => d.date) as [Date, Date])
      .range([0, innerWidth]);

    const yMax = d3.max(parsedData, (d) =>
      Math.max(d.nwm, d.usgs, d.corrected, d.upper_ci || 0)
    )!;
    const yScale = d3
      .scaleLinear()
      .domain([0, yMax * 1.1])
      .range([innerHeight, 0]);

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(6);
    const yAxis = d3.axisLeft(yScale).ticks(6);

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', '#9ca3af');

    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', '#9ca3af');

    // Axis labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .attr('fill', '#9ca3af')
      .text('Time');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -45)
      .attr('text-anchor', 'middle')
      .attr('fill', '#9ca3af')
      .text('Streamflow (m³/s)');

    // Confidence interval area
    if (showConfidenceInterval) {
      const ciArea = d3
        .area<typeof parsedData[0]>()
        .x((d) => xScale(d.date))
        .y0((d) => yScale(d.lower_ci || d.corrected))
        .y1((d) => yScale(d.upper_ci || d.corrected))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(parsedData)
        .attr('fill', '#6366f1')
        .attr('fill-opacity', 0.15)
        .attr('d', ciArea);
    }

    // Line generators
    const lineGenerator = (accessor: (d: typeof parsedData[0]) => number) =>
      d3
        .line<typeof parsedData[0]>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(accessor(d)))
        .curve(d3.curveMonotoneX);

    // NWM line (dashed, gray)
    g.append('path')
      .datum(parsedData)
      .attr('fill', 'none')
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,4')
      .attr('d', lineGenerator((d) => d.nwm));

    // USGS line (solid, blue)
    g.append('path')
      .datum(parsedData)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('d', lineGenerator((d) => d.usgs));

    // Corrected line (solid, green)
    g.append('path')
      .datum(parsedData)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2)
      .attr('d', lineGenerator((d) => d.corrected));

    // Legend
    const legend = g
      .append('g')
      .attr('transform', `translate(${innerWidth + 10}, 0)`);

    const legendItems = [
      { label: 'USGS (Obs)', color: '#3b82f6', dash: false },
      { label: 'NWM (Raw)', color: '#9ca3af', dash: true },
      { label: 'Hydra (Corr)', color: '#10b981', dash: false },
    ];

    legendItems.forEach((item, i) => {
      const legendGroup = legend
        .append('g')
        .attr('transform', `translate(0, ${i * 25})`);

      legendGroup
        .append('line')
        .attr('x1', 0)
        .attr('x2', 25)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', item.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', item.dash ? '4,4' : 'none');

      legendGroup
        .append('text')
        .attr('x', 30)
        .attr('y', 4)
        .attr('fill', '#e5e7eb')
        .attr('font-size', '12px')
        .text(item.label);
    });

    // Tooltip
    const tooltip = d3
      .select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', '#1f2937')
      .style('border', '1px solid #374151')
      .style('border-radius', '4px')
      .style('padding', '8px')
      .style('font-size', '12px')
      .style('color', '#e5e7eb');

    // Hover overlay
    const bisect = d3.bisector<typeof parsedData[0], Date>((d) => d.date).left;

    svg
      .append('rect')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mousemove', function (event) {
        const [mx] = d3.pointer(event, this);
        const x0 = xScale.invert(mx);
        const i = bisect(parsedData, x0, 1);
        const d = parsedData[i];
        if (d) {
          tooltip
            .style('visibility', 'visible')
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`)
            .html(`
              <strong>${d3.timeFormat('%Y-%m-%d %H:%M')(d.date)}</strong><br/>
              USGS: ${d.usgs.toFixed(2)} m³/s<br/>
              NWM: ${d.nwm.toFixed(2)} m³/s<br/>
              Corrected: ${d.corrected.toFixed(2)} m³/s
            `);
        }
      })
      .on('mouseout', () => {
        tooltip.style('visibility', 'hidden');
      });

    return () => {
      tooltip.remove();
    };
  }, [data, width, height, showConfidenceInterval]);

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <svg ref={svgRef} width={width} height={height} className="w-full" />
    </div>
  );
}
