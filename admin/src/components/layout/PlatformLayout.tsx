import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { DEMO_MODE, PLATFORM_NAME, PLATFORM_NAV_ITEMS } from '../../config';
import { useAuth } from '../../features/auth/AuthContext';
import { Avatar, Button } from '../ui/primitives';
import { Icon } from '../ui/Icon';

export function PlatformLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const current = PLATFORM_NAV_ITEMS.find((item) => (
    item.to === '/platform' ? location.pathname === '/platform' : location.pathname.startsWith(item.to)
  ));

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand">
          <span className="brand-mark">青</span>
          <span className="brand-copy">
            <strong>青跑团</strong>
            <small>平台总后台</small>
          </span>
        </div>

        <div className="club-chip">
          <span>管理范围</span>
          <strong>全国社团 · 平台治理</strong>
        </div>

        <nav className="admin-nav" aria-label="平台总后台导航">
          {PLATFORM_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/platform'}
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
            <span>{DEMO_MODE ? '平台数据已清空，当前为空状态' : '数据来自 PocketBase'}</span>
          </div>
          <div className="sidebar-version">V0.1 · 平台治理</div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="topbar">
          <div className="topbar-location">
            <span>{PLATFORM_NAME.replace(' · 平台总后台', '')}</span>
            <Icon name="chevronRight" size={13} />
            <strong>{current?.label ?? '平台总后台'}</strong>
          </div>
          <div className="topbar-actions">
            {DEMO_MODE ? <span className="demo-pill">空白数据</span> : null}
            <div className="topbar-user">
              <Avatar name={user?.name ?? '平'} size="sm" tone="green" />
              <span>{user?.name ?? '平台管理员'}</span>
            </div>
            <Button variant="ghost" size="sm" icon="logout" onClick={handleLogout}>退出</Button>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
