import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

export interface DetailTab {
  key: string;
  label: string;
  count?: number;
}

export function DetailHeader({
  backTo,
  backLabel,
  title,
  subtitle,
  badges,
  actions,
}: {
  backTo: string;
  backLabel: string;
  title: string;
  subtitle: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="detail-head">
      <Link to={backTo} className="detail-back">
        <Icon name="arrowLeft" size={15} />
        <span>{backLabel}</span>
      </Link>
      <div className="detail-head-row">
        <div>
          <div className="detail-title-row">
            <h1 className="page-title">{title}</h1>
            {badges}
          </div>
          <p className="page-desc">{subtitle}</p>
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export function DetailTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: DetailTab[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="detail-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          className={'detail-tab' + (active === tab.key ? ' detail-tab-active' : '')}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {typeof tab.count === 'number' ? <span>{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
