import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendChartProps {
  title: string;
  data: any[];
  dataKey: string;
  color: string;
  unit?: string;
}

export function TrendChart({ title, data, dataKey, color }: TrendChartProps) {
  return (
    <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl p-4 neon-glow animate-fade-in">
      <h3 className="text-lg text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 229, 255, 0.1)" />
          <XAxis
            dataKey="time"
            stroke="#D9DCE1"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#D9DCE1"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0C1E2C',
              border: '1px solid rgba(0, 229, 255, 0.5)',
              borderRadius: '8px',
              boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)'
            }}
            labelStyle={{ color: '#00E5FF' }}
            itemStyle={{ color: color }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={3}
            dot={{ fill: color, r: 4 }}
            activeDot={{ r: 6, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}