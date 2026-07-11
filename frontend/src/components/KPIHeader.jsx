import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

const KPI_CONFIG = [
  {
    key: 'activeDrivers',
    label: 'Active Drivers',
    icon: '🚚',
    color: '#00d4ff',
    suffix: '',
    dimColor: 'rgba(0,212,255,0.12)',
  },
  {
    key: 'onTimeRate',
    label: 'On-Time Rate',
    icon: '📊',
    color: '#00ff88',
    suffix: '%',
    dimColor: 'rgba(0,255,136,0.12)',
  },
  {
    key: 'delayedPackages',
    label: 'Delayed',
    icon: '⚠️',
    color: '#ffb800',
    suffix: ' pkgs',
    dimColor: 'rgba(255,184,0,0.12)',
  },
  {
    key: 'inTransitPackages',
    label: 'In Transit',
    icon: '📦',
    color: '#a855f7',
    suffix: ' pkgs',
    dimColor: 'rgba(168,85,247,0.12)',
  },
];

function AnimatedNumber({ value, color }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current === value) return;
    const start = prevRef.current;
    const end = value;
    const diff = end - start;
    const steps = 20;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setDisplay(Math.round(start + (diff * step) / steps));
      if (step >= steps) { clearInterval(interval); setDisplay(end); }
    }, 30);
    prevRef.current = value;
    return () => clearInterval(interval);
  }, [value]);

  return (
    <motion.span
      key={value}
      initial={{ scale: 1.3, color: '#fff' }}
      animate={{ scale: 1, color }}
      transition={{ duration: 0.4 }}
      style={{ fontFamily: 'JetBrains Mono, monospace', color }}
      className="text-3xl font-bold tabular-nums"
    >
      {display}
    </motion.span>
  );
}

export default function KPIHeader({ kpis, connected }) {
  return (
    <header
      className="glass"
      style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid rgba(0,212,255,0.12)',
        padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        height: 72,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8, minWidth: 'max-content' }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'linear-gradient(135deg, #00d4ff22, #00d4ff44)',
          border: '1.5px solid #00d4ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>🗺️</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#e8f4ff', letterSpacing: '-0.02em' }}>
            DispatchOps
          </div>
          <div style={{ fontSize: 10, color: '#3d5a7a', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Control Center
          </div>
        </div>
      </div>

      <div style={{ width: 1, height: 40, background: 'rgba(0,212,255,0.12)', margin: '0 8px' }} />

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 10, flex: 1 }}>
        {KPI_CONFIG.map(cfg => (
          <div
            key={cfg.key}
            className="kpi-card"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            {/* Glow accent bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
              opacity: 0.6,
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{cfg.icon}</span>
              <span style={{ fontSize: 11, color: '#6b8aaa', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 500 }}>
                {cfg.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <AnimatedNumber value={kpis[cfg.key] ?? 0} color={cfg.color} />
              {cfg.suffix && (
                <span style={{ fontSize: 12, color: '#6b8aaa' }}>{cfg.suffix}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Connection Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 'max-content', marginLeft: 8 }}>
        <div style={{ position: 'relative', width: 10, height: 10 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: connected ? '#00ff88' : '#ff4444',
          }} />
          {connected && (
            <div
              className="animate-ping-dot"
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: '#00ff88',
              }}
            />
          )}
        </div>
        <span style={{ fontSize: 12, color: connected ? '#00ff88' : '#ff4444', fontWeight: 500 }}>
          {connected ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>
    </header>
  );
}
