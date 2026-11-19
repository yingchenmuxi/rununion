import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { APP_NAME, DEMO_MODE } from '../../config';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../../data/mock/mockData';
import { PLATFORM_EMAIL, PLATFORM_PASSWORD } from '../../data/mock/mockData';
import { Button, Field } from '../../components/ui/primitives';
import { Icon, type IconName } from '../../components/ui/Icon';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from './AuthContext';

interface DemoAccount {
  key: string;
  label: string;
  scope: string;
  email: string;
  password: string;
  icon: IconName;
}

const demoAccounts: DemoAccount[] = [
  {
    key: 'owner',
    label: '社团负责人',
    scope: '康福外国语学校长跑社',
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    icon: 'users',
  },
  {
    key: 'platform',
    label: '平台管理员',
    scope: '全国社团与内容治理',
    email: PLATFORM_EMAIL,
    password: PLATFORM_PASSWORD,
    icon: 'shield',
  },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState(DEMO_MODE ? ADMIN_EMAIL : '');
  const [password, setPassword] = useState(DEMO_MODE ? ADMIN_PASSWORD : '');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={user.role === 'platform' ? '/platform' : '/'} replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const nextUser = await login(email, password);
      toast(nextUser.role === 'platform' ? '登录成功，已进入平台总后台。' : '登录成功，欢迎回来。');
      navigate(nextUser.role === 'platform' ? '/platform' : '/', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-intro">
        <div className="login-brand">
          <span className="login-mark">青</span>
          <span>{APP_NAME}</span>
        </div>
        <div className="login-intro-copy">
          <span className="login-eyebrow">社团负责人 · 平台管理员</span>
          <h1>让每一次坚持，<br />都有地方被看见。</h1>
          <p>社团后台负责成员、活动和记录；平台后台负责入驻、内容与风险。两个入口，一套对青少年更友好的秩序。</p>
        </div>
        <ul className="login-features">
          <li><span><Icon name="users" size={17} /></span>社团名册、审批与训练记录</li>
          <li><span><Icon name="megaphone" size={17} /></span>公告、活动与线上挑战</li>
          <li><span><Icon name="shield" size={17} /></span>平台审核、举报与操作留痕</li>
        </ul>
        <div className="login-intro-foot">
          <span>青跑团 · 青少年长跑公益生态</span>
          <span>V0.1 · 社团 + 平台</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card-head">
            <span className="login-card-label">WELCOME BACK</span>
            <h2>登录管理后台</h2>
            <p>社团负责人和平台管理员使用各自账号登录，进入不同的工作台。</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <Field label="账号" htmlFor="login-email">
              <input
                id="login-email"
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@qingrun.local"
                required
              />
            </Field>
            <Field label="密码" htmlFor="login-password">
              <div className="input-with-action">
                <input
                  id="login-password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                  required
                />
                <button
                  type="button"
                  className="input-action"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  <Icon name={showPassword ? 'eye' : 'lock'} size={17} />
                </button>
              </div>
            </Field>

            {error ? <div className="form-error"><Icon name="alert" size={16} /><span>{error}</span></div> : null}

            <Button variant="primary" type="submit" loading={busy} className="login-submit">进入管理后台</Button>
          </form>

          {DEMO_MODE ? (
            <div className="demo-accounts">
              {demoAccounts.map((account) => (
                <div className="demo-account" key={account.key}>
                  <div>
                    <span className="demo-account-title">
                      <Icon name={account.icon} size={13} />
                      {account.label} · {account.scope}
                    </span>
                    <code>{account.email}</code>
                    <code>{account.password}</code>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                      setError(null);
                    }}
                  >
                    填入账号
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <p className="login-footnote">社团后台只查看社团可见的跑步记录；平台后台仅限授权管理员，所有管理操作写入审计日志。</p>
        </div>
      </section>
    </div>
  );
}
