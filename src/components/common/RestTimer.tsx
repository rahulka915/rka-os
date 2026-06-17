import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, X } from 'lucide-react';
import './rest-timer.css';

interface RestTimerProps {
  initialSeconds?: number;
  onClose?: () => void;
  autoStart?: boolean;
}

export function RestTimer({ initialSeconds = 60, onClose, autoStart = true }: RestTimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      // Optional: Trigger haptic or sound here
      if (navigator.vibrate) navigator.vibrate(500);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft]);

  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(initialSeconds);
  };
  const addTime = (seconds: number) => {
    setTimeLeft(prev => prev + seconds);
    setIsRunning(true);
  };
  const setTime = (seconds: number) => {
    setTimeLeft(seconds);
    setIsRunning(true);
  };

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rest-timer-container">
      <div className="rest-timer-header">
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rest Timer</span>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        )}
      </div>

      <div className="rest-timer-display" style={{ color: timeLeft === 0 ? 'var(--accent-color)' : '#FFF' }}>
        {formatTime(timeLeft)}
      </div>

      <div className="rest-timer-controls">
        <button className="rest-btn icon-btn" onClick={resetTimer}><RotateCcw size={18} /></button>
        <button className="rest-btn icon-btn primary" onClick={toggleTimer}>
          {isRunning ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
        <button className="rest-btn" onClick={() => addTime(30)}>+30s</button>
      </div>

      <div className="rest-timer-presets">
        <button onClick={() => setTime(30)}>30s</button>
        <button onClick={() => setTime(60)}>60s</button>
        <button onClick={() => setTime(90)}>90s</button>
        <button onClick={() => setTime(120)}>2m</button>
      </div>
    </div>
  );
}
