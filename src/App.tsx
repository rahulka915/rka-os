import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { Today } from './pages/Today';
import { Home } from './pages/Home';
import { Projects } from './pages/Projects';
import { HealthSearch } from './pages/Health';
import { ActiveWorkout } from './pages/ActiveWorkout';
import { Inbox } from './pages/Inbox';
import { Calendar } from './pages/Calendar';
import { TemplateBuilder } from './pages/TemplateBuilder';
import { InspectorProvider } from './components/shell/InspectorContext';
import { ExerciseLibrary } from './pages/ExerciseLibrary';
import { AuthPage } from './pages/Auth';
import { WelcomePage } from './pages/Welcome';
import { ProfilePage } from './pages/Profile';
import { SettingsPage } from './pages/Settings';
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
            <Route path="today" element={<Today />} />
            <Route path="projects" element={<Projects />} />
            <Route path="health-search" element={<HealthSearch />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
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
