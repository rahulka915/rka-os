import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { Home } from './pages/Home';
import { Projects } from './pages/Projects';
import { HealthSearch } from './pages/Health';
import { Medications } from './pages/Medications';
import { Workouts } from './pages/Workouts';
import { ActiveWorkout } from './pages/ActiveWorkout';
import { Calendar } from './pages/Calendar';
import { TemplateBuilder } from './pages/TemplateBuilder';
import { InspectorProvider } from './components/shell/InspectorContext';
import { ExerciseLibrary } from './pages/ExerciseLibrary';
import { AuthPage } from './pages/Auth';
import { WelcomePage } from './pages/Welcome';
import { ProfilePage } from './pages/Profile';
import { RequireAuth } from './auth/RequireAuth';

function App() {
  return (
    <BrowserRouter>
      <InspectorProvider>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/welcome"
            element={
              <RequireAuth allowOnboarding>
                <WelcomePage />
              </RequireAuth>
            }
          />
          <Route
            path="/"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="home" element={<Home />} />
            <Route path="today" element={<Navigate to="/calendar" replace />} />
            <Route path="projects" element={<Projects />} />
            <Route path="medications" element={<Medications />} />
            <Route path="workouts" element={<Workouts />} />
            <Route path="health-search" element={<HealthSearch />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="/active-workout/:id" element={<RequireAuth><ActiveWorkout /></RequireAuth>} />
          <Route path="/template-builder/:id" element={<RequireAuth><TemplateBuilder /></RequireAuth>} />
          <Route path="/exercise-library" element={<RequireAuth><ExerciseLibrary /></RequireAuth>} />
        </Routes>
      </InspectorProvider>
    </BrowserRouter>
  );
}

export default App;
