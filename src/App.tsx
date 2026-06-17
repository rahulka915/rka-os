import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { Today } from './pages/Today';
import { Home } from './pages/Home';
import { Projects } from './pages/Projects';
import { HealthSearch } from './pages/Health';
import { ActiveWorkout } from './pages/ActiveWorkout';
import { Inbox } from './pages/Inbox';
import { Calendar } from './pages/Calendar';
import { InspectorProvider } from './components/shell/InspectorContext';

function App() {
  return (
    <BrowserRouter>
      <InspectorProvider>
        <Routes>
          <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="today" element={<Today />} />
          <Route path="projects" element={<Projects />} />
          <Route path="health-search" element={<HealthSearch />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="calendar" element={<Calendar />} />
        </Route>
        <Route path="/active-workout/:id" element={<ActiveWorkout />} />
      </Routes>
      </InspectorProvider>
    </BrowserRouter>
  );
}

export default App;
