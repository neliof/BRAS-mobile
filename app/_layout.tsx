import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '../src/state/SessionContext';

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </SessionProvider>
  );
}
