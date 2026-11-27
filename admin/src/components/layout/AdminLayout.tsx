import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME, CLUB_NAME, DEMO_MODE, NAV_ITEMS } from '../../config';
import { useAuth } from '../../features/auth/AuthContext';
import { Avatar, Button } from '../ui/primitives';
import { Icon } from '../ui/Icon';

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const current = NAV_ITEMS.find((item) => (item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)));

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
            <span>{DEMO_MODE ? '当前为空白数据模式' : '数据来自 PocketBase'}</span>
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
    </div>
  );
}
