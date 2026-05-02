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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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

  const formatValue = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-[2rem] m-2 bg-secondary/5">
        <PieChart className="h-10 w-10 opacity-20 mb-2" />
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No Focus Data Recorded</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ScrollArea className="h-[350px] w-full">
        <ChartContainer
          config={chartConfig}
          className="w-full h-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <ChartTooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-background border rounded-xl p-3 shadow-2xl">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1">{payload[0].name}</p>
                        <p className="text-lg font-black text-primary">{formatValue(payload[0].value as number)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Pie 
                data={data} 
                dataKey="value" 
                nameKey="name" 
                innerRadius={60} 
                outerRadius={90} 
                paddingAngle={8}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} className="hover:opacity-80 transition-opacity cursor-pointer" />
                ))}
              </Pie>
              <ChartLegend
                content={<ChartLegendContent nameKey="name" />}
                className="flex-wrap pt-4 justify-center gap-x-4 gap-y-2"
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </ScrollArea>
    </div>
  );
}
