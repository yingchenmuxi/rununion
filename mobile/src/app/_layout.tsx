import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppTabs from '@/components/app-tabs';
import { ActivityProvider } from '@/features/activities/ActivityContext';
import { AnnouncementProvider } from '@/features/announcements/AnnouncementContext';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { ApprovedScreen, AuthScreen, PendingScreen, RejectedScreen } from '@/features/auth/AuthScreen';
import { KnowledgeProvider } from '@/features/knowledge/KnowledgeContext';
import { NotificationProvider } from '@/features/notifications/NotificationContext';
import { RunProvider } from '@/features/runs/RunContext';

void SplashScreen.preventAutoHideAsync().catch(() => {});

function RootContent() {
  const { status } = useAuth();

  if (status === 'guest') return <AuthScreen />;
  if (status === 'pending') return <PendingScreen />;
  if (status === 'approved') return <ApprovedScreen />;
  if (status === 'rejected') return <RejectedScreen />;
  return <AppTabs />;
}

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <ActivityProvider>
          <NotificationProvider>
          <AnnouncementProvider>
          <KnowledgeProvider>
            <RunProvider>
              <RootContent />
            </RunProvider>
          </KnowledgeProvider>
          </AnnouncementProvider>
          </NotificationProvider>
        </ActivityProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}