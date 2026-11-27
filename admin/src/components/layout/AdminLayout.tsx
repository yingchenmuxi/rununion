import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME, CLUB_NAME, DEMO_MODE, NAV_ITEMS } from '../../config';
import { activityApi } from '../../data/activityApi';
import { useAuth } from '../../features/auth/AuthContext';
import { Avatar, Button } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pushToast = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const current = NAV_ITEMS.find((item) => (item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)));

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await activityApi.resetDemo();
      setResetOpen(false);
      pushToast('数据已重置，正在刷新页面。', 'success');
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '重置失败，请稍后再试。', 'error');
      setResetting(false);
    }
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand">
          <span className="brand-mark">青</span>
          <span className="brand-copy">
            <strong>青跑团</strong>
            <small>管理后台</small>
          </span>
        </div>

        <div className="club-chip">
          <span>当前社团</span>
          <strong>{CLUB_NAME}</strong>
        </div>

        <nav className="admin-nav" aria-label="管理后台导航">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => 'nav-item' + (isActive ? ' nav-item-active' : '')}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-note">
            <Icon name="shield" size={16} />
            <span>{DEMO_MODE ? '当前为空白数据，可在右上角重置' : '数据来自 PocketBase'}</span>
          </div>
          <div className="sidebar-version">V0.1 · 社团运营</div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="topbar">
          <div className="topbar-location">
            <span>{APP_NAME.replace(' · 管理后台', '')}</span>
            <Icon name="chevronRight" size={13} />
            <strong>{current?.label ?? '管理后台'}</strong>
          </div>
          <div className="topbar-actions">
            {DEMO_MODE ? <span className="demo-pill">空白数据</span> : null}
            <Button variant="ghost" size="sm" icon="refresh" onClick={() => setResetOpen(true)}>重置数据</Button>
            <div className="topbar-user">
              <Avatar name={user?.name ?? '管'} size="sm" tone="coral" />
              <span>{user?.name ?? '管理员'}</span>
            </div>
            <Button variant="ghost" size="sm" icon="logout" onClick={handleLogout}>退出</Button>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="重置数据？"
        description="当前为空白数据模式，重置后仍为空；手机端刷新后也会保持空状态。"
        confirmText="重置数据"
        loading={resetting}
        onConfirm={handleReset}
        onClose={() => { if (!resetting) setResetOpen(false); }}
      />
    </div>
  );
}
