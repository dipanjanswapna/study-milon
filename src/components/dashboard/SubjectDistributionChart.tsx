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

  const formatValue = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const totalMins = data.reduce((acc, curr) => acc + curr.value, 0);

  if (!data || data.length === 0) {
    return (
      <div className="h-[350px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-[2rem] m-2 bg-secondary/5">
        <PieChart className="h-10 w-10 opacity-20 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 text-center px-4">No Focus Data for this Period</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="h-[350px] w-full relative">
        {/* Total Center Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
           <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Total Hustle</p>
           <p className="text-xl font-black tracking-tighter text-primary">{formatValue(totalMins)}</p>
        </div>

        <ChartContainer
          config={chartConfig}
          className="w-full h-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <ChartTooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const pct = ((payload[0].value as number) / totalMins * 100).toFixed(1);
                    return (
                      <div className="bg-background border-2 border-primary/10 rounded-2xl p-4 shadow-2xl backdrop-blur-xl">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{payload[0].name}</p>
                        <p className="text-2xl font-black text-primary">{formatValue(payload[0].value as number)}</p>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[9px] font-bold text-success uppercase">{pct}% of total</span>
                        </div>
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
                innerRadius={75} 
                outerRadius={105} 
                paddingAngle={4}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`hsl(var(--chart-${(index % 5) + 1}))`} 
                    className="hover:opacity-80 transition-all duration-300 cursor-pointer outline-none" 
                  />
                ))}
              </Pie>
              <ChartLegend
                content={<ChartLegendContent nameKey="name" />}
                className="flex-wrap pt-6 justify-center gap-x-6 gap-y-3"
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
}
