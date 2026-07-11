import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useEffect } from 'react';

const TYPE_LABELS = {
  TRAFFIC_SPIKE: { icon: '🚦', label: 'Traffic Spike' },
  VEHICLE_BREAKDOWN: { icon: '🔧', label: 'Breakdown' },
  CUSTOMER_CANCELLATION: { icon: '❌', label: 'Cancelled' },
  MANUAL_REASSIGN: { icon: '📦', label: 'Reassigned' },
  ROUTE_UPDATED: { icon: '🗺️', label: 'Route Updated' },
};

function PackageCard({ event, onDragStart }) {
  const isDelayed = event.type === 'TRAFFIC_SPIKE' && event.affectedDeliveryId;

  return (
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className={`chaos-event severity-${event.severity}`}
      draggable={isDelayed}
      onDragStart={isDelayed ? (e) => {
        e.dataTransfer.setData('packageId', event.affectedDeliveryId.toString());
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(event);
      } : undefined}
      style={{ cursor: isDelayed ? 'grab' : 'default' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>
          {TYPE_LABELS[event.type]?.icon || '⚡'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: event.severity === 'red' ? '#ff4444' : event.severity === 'yellow' ? '#ffb800' : '#888',
            }}>
              {TYPE_LABELS[event.type]?.label || event.type}
            </span>
            {isDelayed && (
              <span style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 4,
                background: 'rgba(0,212,255,0.15)', color: '#00d4ff',
                fontWeight: 600, letterSpacing: '0.04em',
              }}>
                DRAG TO REASSIGN
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#c8ddf5', lineHeight: 1.4, wordBreak: 'break-word' }}>
            {event.message}
          </p>
          <p style={{ fontSize: 10, color: '#3d5a7a', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
            {new Date(event.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function ChaosFeed({ events }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length]);

  return (
    <aside style={{
      width: 300,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-card)',
      }}>
        <div style={{ position: 'relative', width: 8, height: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff4444' }} />
          <div className="animate-ping-dot" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#ff4444' }} />
        </div>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#e8f4ff' }}>Chaos Feed</span>
        <span style={{
          marginLeft: 'auto', fontSize: 11, padding: '2px 8px',
          borderRadius: 999, background: 'rgba(255,68,68,0.15)', color: '#ff4444',
          fontWeight: 600,
        }}>
          {events.length}
        </span>
      </div>

      {/* Legend */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 12,
        background: 'rgba(6,11,24,0.5)',
      }}>
        {[
          { color: '#ff4444', label: 'Critical' },
          { color: '#ffb800', label: 'Warning' },
          { color: '#555', label: 'Info' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 10, color: '#6b8aaa' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Feed */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}
      >
        {events.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: 200, gap: 10, color: '#3d5a7a',
          }}>
            <span style={{ fontSize: 32 }}>🌐</span>
            <span style={{ fontSize: 13 }}>Monitoring live events…</span>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {events.map((event, i) => (
              <PackageCard key={`${event.timestamp}-${i}`} event={event} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer tip */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid var(--border)',
        fontSize: 10, color: '#3d5a7a', textAlign: 'center',
        background: 'rgba(6,11,24,0.5)',
      }}>
        💡 Drag delayed packages onto drivers to manually reassign
      </div>
    </aside>
  );
}
