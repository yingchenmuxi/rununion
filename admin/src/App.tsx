import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/layout/AdminLayout';
import { PlatformLayout } from './components/layout/PlatformLayout';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { OverviewPage } from './features/overview/OverviewPage';
import { MembersPage } from './features/members/MembersPage';
import { InvitesPage } from './features/invites/InvitesPage';
import { AnnouncementsPage } from './features/announcements/AnnouncementsPage';
import { ChallengesPage } from './features/challenges/ChallengesPage';
import { ActivitiesPage } from './features/activities/ActivitiesPage';
import { ActivityDetailPage } from './features/activities/ActivityDetailPage';
import { RecordsPage } from './features/records/RecordsPage';
import { PlatformOverviewPage } from './features/platform/PlatformOverviewPage';
import { PlatformClubsPage } from './features/platform/PlatformClubsPage';
import { PlatformClubDetailPage } from './features/platform/PlatformClubDetailPage';
import { PlatformUsersPage } from './features/platform/PlatformUsersPage';
import { PlatformUserDetailPage } from './features/platform/PlatformUserDetailPage';
import { PlatformContentPage } from './features/platform/PlatformContentPage';
import { PlatformRecordsPage } from './features/platform/PlatformRecordsPage';
import { PlatformModerationPage } from './features/platform/PlatformModerationPage';
import { PlatformSystemPage } from './features/platform/PlatformSystemPage';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RequireAuth role="owner" />}>
              <Route element={<AdminLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="members" element={<MembersPage />} />
                <Route path="invites" element={<InvitesPage />} />
                <Route path="announcements" element={<AnnouncementsPage />} />
                <Route path="activities" element={<ActivitiesPage />} />
                <Route path="activities/:activityId" element={<ActivityDetailPage />} />
                <Route path="challenges" element={<ChallengesPage />} />
                <Route path="records" element={<RecordsPage />} />
              </Route>
            </Route>

            <Route path="platform" element={<RequireAuth role="platform" />}>
              <Route element={<PlatformLayout />}>
                <Route index element={<PlatformOverviewPage />} />
                <Route path="clubs" element={<PlatformClubsPage />} />
                <Route path="clubs/:clubId" element={<PlatformClubDetailPage />} />
                <Route path="users" element={<PlatformUsersPage />} />
                <Route path="users/:userId" element={<PlatformUserDetailPage />} />
                <Route path="content" element={<PlatformContentPage />} />
                <Route path="records" element={<PlatformRecordsPage />} />
                <Route path="moderation" element={<PlatformModerationPage />} />
                <Route path="system" element={<PlatformSystemPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
