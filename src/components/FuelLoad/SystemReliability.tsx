import { Wifi, Satellite, Activity, Database, RefreshCw } from 'lucide-react';

export function SystemReliability() {
  const systems = [
    {
      name: 'GPS Network',
      status: 'online',
      uptime: 99.8,
      lastUpdate: '2 mins ago',
      icon: Satellite,
      color: '#28B463'
    },
    {
      name: 'Fuel Sensors',
      status: 'online',
      uptime: 98.5,
      lastUpdate: '1 min ago',
      icon: Activity,
      color: '#28B463'
    },
    {
      name: 'Load Sensors',
      status: 'online',
      uptime: 99.2,
      lastUpdate: '3 mins ago',
      icon: Activity,
      color: '#28B463'
    },
    {
      name: 'Network Connectivity',
      status: 'degraded',
      uptime: 95.3,
      lastUpdate: '5 mins ago',
      icon: Wifi,
      color: '#FFB02E'
    },
    {
      name: 'Data Sync',
      status: 'syncing',
      uptime: 97.8,
      lastUpdate: 'Just now',
      icon: RefreshCw,
      color: '#00E5FF'
    },
    {
      name: 'Database',
      status: 'online',
      uptime: 99.9,
      lastUpdate: '1 min ago',
      icon: Database,
      color: '#28B463'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#28B463';
      case 'degraded': return '#FFB02E';
      case 'syncing': return '#00E5FF';
      case 'offline': return '#FF4D4D';
      default: return '#7F8C8D';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'online': return 'bg-[#28B463]/20 border-[#28B463]/50';
      case 'degraded': return 'bg-[#FFB02E]/20 border-[#FFB02E]/50';
      case 'syncing': return 'bg-[#00E5FF]/20 border-[#00E5FF]/50';
      case 'offline': return 'bg-[#FF4D4D]/20 border-[#FF4D4D]/50';
      default: return 'bg-[#7F8C8D]/20 border-[#7F8C8D]/50';
    }
  };

  return (
    <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl p-4 neon-glow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#28B463]/20 rounded-lg">
            <Activity className="w-5 h-5 text-[#28B463]" />
          </div>
          <div>
            <h3 className="text-lg text-white neon-text">System Reliability</h3>
            <p className="text-xs text-[#D9DCE1]/60">Real-time system health monitoring</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl text-[#28B463]">98.6%</div>
          <div className="text-xs text-[#D9DCE1]/60">Overall Uptime</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {systems.map((system, index) => {
          const Icon = system.icon;
          return (
            <div
              key={system.name}
              style={{ animationDelay: `${index * 0.05}s` }}
              className={`p-3 rounded-lg border ${getStatusBg(system.status)} transition-all duration-200 hover:scale-105 animate-fade-in`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon 
                    className={`w-4 h-4 ${system.status === 'syncing' ? 'animate-spin' : ''}`} 
                    style={{ color: system.color }}
                  />
                  <span className="text-sm text-white">{system.name}</span>
                </div>
                <div
                  className="w-2 h-2 rounded-full pulse-glow"
                  style={{ backgroundColor: getStatusColor(system.status) }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-[#D9DCE1]/60">Uptime</div>
                  <div className="text-lg" style={{ color: system.color }}>
                    {system.uptime}%
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-xs px-2 py-1 rounded border capitalize ${getStatusBg(system.status)}`}
                    style={{ color: getStatusColor(system.status) }}
                  >
                    {system.status}
                  </div>
                  <div className="text-[10px] text-[#D9DCE1]/50 mt-1">
                    {system.lastUpdate}
                  </div>
                </div>
              </div>

              {/* Mini Progress Bar */}
              <div className="mt-2 h-1 bg-[#07121A] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${system.uptime}%`,
                    backgroundColor: system.color
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Offline Data Sync Progress */}
      <div className="mt-4 p-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[#00E5FF] animate-spin" />
            <span className="text-sm text-white">Offline Data Sync</span>
          </div>
          <span className="text-sm text-[#00E5FF]">87%</span>
        </div>
        <div className="h-2 bg-[#0C1E2C] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#009FFD] to-[#00E5FF] rounded-full transition-all duration-500"
            style={{ width: '87%' }}
          />
        </div>
        <div className="text-xs text-[#D9DCE1]/50 mt-1">
          Syncing 142 of 163 records...
        </div>
      </div>

      {/* Network Reconnection Status */}
      <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-[#28B463]/10 border border-[#28B463]/30 rounded-lg">
        <Wifi className="w-4 h-4 text-[#28B463]" />
        <span className="text-xs text-[#28B463]">All vehicles connected</span>
        <span className="text-xs text-[#D9DCE1]/50 ml-auto">6/6 online</span>
      </div>
    </div>
  );
}
