'use client';
import React from 'react';
import { Pie, PieChart } from 'recharts';
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
      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
        <p>No study data to display yet.</p>
      </div>
    );
  }

  return (
    <div className="h-[250px]">
      <ChartContainer
        config={chartConfig}
        className="w-full h-full"
      >
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
          <Pie data={data} dataKey="value" nameKey="name" label />
          <ChartLegend
            content={<ChartLegendContent nameKey="name" />}
            className="-mt-4"
          />
        </PieChart>
      </ChartContainer>
    </div>
  );
}
