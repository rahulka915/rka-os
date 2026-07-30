import { BackupProvider, useBackup } from './src/hooks/useBackup';
import { AppShell } from './src/webApp/AppShell';
import { SignInScreen } from './src/webApp/SignInScreen';

function AppContent() {
  const { isSignedIn } = useBackup();
  return isSignedIn ? <AppShell /> : <SignInScreen />;
}

export default function App() {
  return (
    <BackupProvider>
      <AppContent />
    </BackupProvider>
  );
}
