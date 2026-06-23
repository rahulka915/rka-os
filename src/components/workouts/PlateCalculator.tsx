import { X } from 'lucide-react';
import { Button } from '../ui/primitives';

interface PlateCalculatorProps {
  weight: number;
  barWeight?: number;
  onClose: () => void;
}

const AVAILABLE_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

// CSS Colors for standard Olympic plates
const PLATE_COLORS: Record<number, string> = {
  25: '#E53E3E', // Red
  20: '#3182CE', // Blue
  15: '#D69E2E', // Yellow
  10: '#38A169', // Green
  5: '#E2E8F0',  // White/Light Gray
  2.5: '#1A202C', // Black
  1.25: '#718096', // Gray
};

const PLATE_HEIGHTS: Record<number, number> = {
  25: 120,
  20: 120,
  15: 100,
  10: 80,
  5: 60,
  2.5: 50,
  1.25: 40,
};

export function PlateCalculator({ weight, barWeight = 20, onClose }: PlateCalculatorProps) {
  // Calculate plates for ONE side
  const calculatePlates = () => {
    let remainingWeight = (weight - barWeight) / 2;
    if (remainingWeight <= 0) return [];

    const plates: number[] = [];
    for (const plate of AVAILABLE_PLATES) {
      while (remainingWeight >= plate) {
        plates.push(plate);
        remainingWeight -= plate;
      }
    }
    return plates;
  };

  const plates = calculatePlates();

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      backdropFilter: 'blur(8px)'
    }}>
      <div style={{
        background: '#15171E',
        borderRadius: '24px',
        padding: '24px',
        width: '100%',
        maxWidth: '400px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#F8FAFC' }}>Plate Calculator</h3>
            <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>{weight}kg target ({barWeight}kg bar)</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {weight < barWeight ? (
          <div style={{ textAlign: 'center', color: '#EF4444', padding: '24px 0' }}>
            Target weight is less than the bar weight!
          </div>
        ) : (
          <>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '160px',
              background: '#0B0D12',
              borderRadius: '16px',
              marginBottom: '24px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* The Bar */}
              <div style={{
                position: 'absolute',
                left: 0, right: '40%',
                height: '16px',
                background: 'linear-gradient(to bottom, #94A3B8, #475569, #94A3B8)',
                zIndex: 1
              }} />
              {/* The Sleeve */}
              <div style={{
                position: 'absolute',
                left: '60%', right: 0,
                height: '24px',
                background: 'linear-gradient(to bottom, #CBD5E1, #64748B, #CBD5E1)',
                zIndex: 1,
                borderLeft: '4px solid #334155'
              }} />

              {/* The Plates (rendered on the sleeve) */}
              <div style={{
                position: 'absolute',
                left: '62%',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                zIndex: 2
              }}>
                {plates.map((plate, idx) => (
                  <div key={idx} style={{
                    width: plate >= 10 ? '24px' : '16px',
                    height: `${PLATE_HEIGHTS[plate]}px`,
                    background: PLATE_COLORS[plate],
                    borderRadius: '4px',
                    boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.3), 2px 0 4px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: plate === 5 || plate === 15 ? '#000' : '#FFF',
                    fontSize: '10px',
                    fontWeight: 800,
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed',
                    transform: 'rotate(180deg)'
                  }}>
                    {plate}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                Load on each side:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {plates.length === 0 ? (
                  <span style={{ color: '#F8FAFC', fontWeight: 500 }}>Just the bar!</span>
                ) : (
                  plates.map((plate, idx) => (
                    <div key={idx} style={{
                      background: PLATE_COLORS[plate],
                      color: plate === 5 || plate === 15 ? '#000' : '#FFF',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 700,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                      {plate} kg
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        <div style={{ width: '100%', marginTop: '24px', display: 'flex' }}>
          <Button onClick={onClose} variant="primary" className="rka-button">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
