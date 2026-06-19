import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, X } from 'lucide-react';
import { Button, IconButton } from '../ui/primitives';
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
        <div className="rest-timer-label">Rest timer</div>
        {onClose && <IconButton label="Close rest timer" icon={<X size={18} />} onClick={onClose} />}
      </div>

      <div className={`rest-timer-display ${timeLeft === 0 ? 'is-finished' : ''}`}>
        {formatTime(timeLeft)}
      </div>

      <div className="rest-timer-controls">
        <Button variant="secondary" icon={<RotateCcw size={18} />} onClick={resetTimer}>
          Reset
        </Button>
        <Button
          variant="primary"
          icon={isRunning ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          onClick={toggleTimer}
        >
          {isRunning ? 'Pause' : 'Start'}
        </Button>
        <Button variant="ghost" onClick={() => addTime(30)}>
          +30s
        </Button>
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
