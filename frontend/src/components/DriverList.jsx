import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DRIVER_COLORS = ['#00d4ff', '#00ff88', '#ffb800', '#a855f7', '#ff6b6b'];
const DRIVER_EMOJIS = ['🚚', '🚛', '🏍️', '🚐', '🛵'];

function DeliveryBadge({ delivery }) {
  const colorMap = {
    IN_TRANSIT: '#00d4ff',
    PENDING: '#ffb800',
    DELAYED: '#ff4444',
    DELIVERED: '#00ff88',
  };
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 999,
      background: `${colorMap[delivery.status]}18`,
      border: `1px solid ${colorMap[delivery.status]}44`,
      fontSize: 10, color: colorMap[delivery.status],
      fontWeight: 600,
    }}>
      📦 #{delivery.id}
    </div>
  );
}

export default function DriverList({ drivers, driverLocations, onDropPackage }) {
  const [dragOverId, setDragOverId] = useState(null);

  const getLocation = (driverId) =>
    driverLocations.find(dl => dl.id === driverId);

  return (
    <aside style={{
      width: 260,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>🚚</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#e8f4ff' }}>Driver Fleet</span>
        <span style={{
          marginLeft: 'auto', fontSize: 11, padding: '2px 8px',
          borderRadius: 999, background: 'rgba(0,212,255,0.1)', color: '#00d4ff',
          fontWeight: 600,
        }}>
          {drivers.length}
        </span>
      </div>

      {/* Driver cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
        {drivers.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#3d5a7a', marginTop: 60, fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            Loading drivers…
          </div>
        ) : (
          <AnimatePresence>
            {drivers.map((driver, idx) => {
              const loc = getLocation(driver.id);
              const color = DRIVER_COLORS[idx % DRIVER_COLORS.length];
              const isOver = dragOverId === driver.id;

              return (
                <motion.div
                  key={driver.id}
                  layout
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(driver.id); }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const packageId = parseInt(e.dataTransfer.getData('packageId'));
                    if (packageId) onDropPackage(packageId, driver.id);
                    setDragOverId(null);
                  }}
                  style={{
                    borderRadius: 10, marginBottom: 8, overflow: 'hidden',
                    border: `1px solid ${isOver ? color : 'var(--border)'}`,
                    background: isOver ? `${color}12` : 'var(--bg-card)',
                    transition: 'all 0.2s',
                    cursor: 'default',
                  }}
                >
                  {/* Top accent bar */}
                  <div style={{ height: 2, background: `linear-gradient(90deg, ${color}, ${color}44)` }} />

                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: `${color}22`, border: `2px solid ${color}66`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16,
                      }}>
                        {DRIVER_EMOJIS[idx % DRIVER_EMOJIS.length]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#e8f4ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {driver.name}
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                          <span className={`status-badge ${loc?.status || driver.status}`}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                            {loc?.status || driver.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Coordinates */}
                    {loc && (
                      <div style={{
                        fontSize: 10, color: '#3d5a7a',
                        fontFamily: 'JetBrains Mono, monospace',
                        marginBottom: 6,
                      }}>
                        {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                      </div>
                    )}

                    {/* Active deliveries */}
                    {driver.deliveries && driver.deliveries.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {driver.deliveries.slice(0, 4).map(d => (
                          <DeliveryBadge key={d.id} delivery={d} />
                        ))}
                        {driver.deliveries.length > 4 && (
                          <span style={{ fontSize: 10, color: '#6b8aaa' }}>
                            +{driver.deliveries.length - 4} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Drop hint */}
                    {isOver && (
                      <div style={{
                        marginTop: 8, padding: '4px 0', textAlign: 'center',
                        fontSize: 11, color, fontWeight: 600,
                        borderTop: `1px dashed ${color}44`,
                        animation: 'pulse-glow 1s ease-in-out infinite',
                      }}>
                        ↓ Drop to assign
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </aside>
  );
}
