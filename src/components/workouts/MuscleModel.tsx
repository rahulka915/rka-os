import { useState } from 'react';
import { getMuscleImage } from '../../utils/workout';

export function MuscleModel({ muscles, className, style }: { muscles: string[], className?: string, style?: React.CSSProperties }) {
  const [isFlipped, setIsFlipped] = useState(false);

  // Get unique image paths for all targeted muscles
  const images = muscles
    .map(m => getMuscleImage([m]))
    .filter((v, i, a) => a.indexOf(v) === i);

  const frontImages = images.filter(src => 
    src.includes('Abs') || src.includes('Biceps') || src.includes('Chest') || src.includes('Forearms') || src.includes('Quads') || src.includes('Shoulders')
  );
  
  const backImages = images.filter(src => 
    src.includes('Back') || src.includes('Calves') || src.includes('Glutes') || src.includes('Hamstrings') || src.includes('Triceps')
  );

  const baseFront = '/images/muscles/Abs [Muscle Icon].png';
  const baseBack = '/images/muscles/Back [Muscle Icon].png';

  const renderStack = (base: string, overlays: string[]) => (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Base model (grayscale so the red highlight is neutralized) */}
      <img 
        src={base} 
        alt="" 
        style={{ 
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
          objectFit: 'contain', filter: 'grayscale(1)', opacity: 0.5 
        }} 
      />
      {/* Highlight overlays */}
      {overlays.map((src) => (
        <img 
          key={src}
          src={src} 
          alt="" 
          style={{ 
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
            objectFit: 'contain', mixBlendMode: 'multiply', opacity: 0.9 
          }} 
        />
      ))}
    </div>
  );

  return (
    <div 
      className={`muscle-model-container ${className || ''}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '120px',
        perspective: '1000px',
        cursor: 'pointer',
        ...style
      }}
      onClick={() => setIsFlipped(!isFlipped)}
      title="Click to rotate body"
    >
      <div 
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transition: 'transform 0.6s',
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}
      >
        {/* Front */}
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden'
        }}>
          {renderStack(baseFront, frontImages)}
        </div>

        {/* Back */}
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)'
        }}>
          {renderStack(baseBack, backImages)}
        </div>
      </div>
    </div>
  );
}
