import { getMuscleImage } from '../../utils/workout';

export function MuscleModel({ muscles, className, style }: { muscles: string[], className?: string, style?: React.CSSProperties }) {
  // Get unique image paths for all targeted muscles
  const images = muscles
    .map(m => getMuscleImage([m]))
    .filter((v, i, a) => a.indexOf(v) === i);

  if (images.length === 0) {
    images.push(getMuscleImage([])); // Fallback to default
  }

  return (
    <div 
      className={`muscle-model-container ${className || ''}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '120px',
        ...style
      }}
    >
      {images.map((src, index) => (
        <img 
          key={src}
          src={src} 
          alt="" 
          style={{ 
            position: index === 0 ? 'relative' : 'absolute',
            top: 0,
            left: 0,
            width: '100%', 
            height: '100%', 
            objectFit: 'contain',
            mixBlendMode: 'multiply',
            opacity: 0.9 // slight opacity so layered red highlights blend nicely
          }} 
        />
      ))}
    </div>
  );
}
