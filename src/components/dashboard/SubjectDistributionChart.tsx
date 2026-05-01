'use client';
import React from 'react';
import { Pie, PieChart, Cell, ResponsiveContainer } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface SubjectDistributionChartProps {
  data: { name: string; value: number }[];
}

export function SubjectDistributionChart({
  data,
}: SubjectDistributionChartProps) {
  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {};
    if (data) {
      data.forEach((item, index) => {
        config[item.name] = {
          label: item.name,
          color: `hsl(var(--chart-${(index % 5) + 1}))`,
        };
      });
    }
    return config;
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl m-4">
        <p className="text-sm font-medium">Start studying to see distribution.</p>
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ChartContainer
        config={chartConfig}
        className="w-full h-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
            <Pie 
              data={data} 
              dataKey="value" 
              nameKey="name" 
              innerRadius={60} 
              outerRadius={80} 
              paddingAngle={5}
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" />}
              className="flex-wrap pt-4"
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
