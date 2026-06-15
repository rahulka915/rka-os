import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { Today } from './pages/Today';
import { Inbox } from './pages/Inbox';
import { Health } from './pages/Health';
import { Habits } from './pages/Habits';
import { Workouts } from './pages/Workouts';
import { ActiveWorkout } from './pages/ActiveWorkout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="today" element={<Today />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="health" element={<Health />} />
          <Route path="habits" element={<Habits />} />
          <Route path="workouts" element={<Workouts />} />
        </Route>
        <Route path="/active-workout/:id" element={<ActiveWorkout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
