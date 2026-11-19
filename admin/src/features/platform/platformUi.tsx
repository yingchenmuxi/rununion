import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import type {
  PlatformClubStatus,
  PlatformContentStatus,
  PlatformContentType,
  PlatformReportStatus,
  PlatformReportTarget,
  PlatformUserStatus,
  RecordSource,
  RecordVisibility,
  RiskLevel,
} from '../../types/models';

type Tone = 'green' | 'coral' | 'gold' | 'gray' | 'blue';

const clubStatus: Record<PlatformClubStatus, { label: string; tone: Tone }> = {
  active: { label: '运行中', tone: 'green' },
  pending: { label: '待审核', tone: 'gold' },
  paused: { label: '已暂停', tone: 'coral' },
  rejected: { label: '未通过', tone: 'gray' },
};

const userStatus: Record<PlatformUserStatus, { label: string; tone: Tone }> = {
  active: { label: '在团', tone: 'green' },
  pending: { label: '待审批', tone: 'gold' },
  suspended: { label: '已暂停', tone: 'coral' },
  left: { label: '已离团', tone: 'gray' },
};

const contentStatus: Record<PlatformContentStatus, { label: string; tone: Tone }> = {
  published: { label: '已发布', tone: 'green' },
  review: { label: '待审核', tone: 'gold' },
  draft: { label: '草稿', tone: 'gray' },
  offline: { label: '已下线', tone: 'coral' },
};

const riskMeta: Record<RiskLevel, { label: string; tone: Tone }> = {
  low: { label: '低风险', tone: 'green' },
  medium: { label: '中风险', tone: 'gold' },
  high: { label: '高风险', tone: 'coral' },
};

const reportStatus: Record<PlatformReportStatus, { label: string; tone: Tone }> = {
  pending: { label: '待处理', tone: 'gold' },
  resolved: { label: '已处理', tone: 'green' },
  dismissed: { label: '已驳回', tone: 'gray' },
};

export const contentTypeLabels: Record<PlatformContentType, string> = {
  announcement: '公告',
  article: '文章',
  activity: '活动',
  challenge: '挑战',
};

export const reportTargetLabels: Record<PlatformReportTarget, string> = {
  user: '用户',
  club: '社团',
  content: '内容',
  record: '记录',
};

export const sourceLabels: Record<RecordSource, string> = {
  manual: '手动记录',
  import: '导入文件',
  activity: '活动计时',
};

export const visibilityLabels: Record<RecordVisibility, string> = {
  club: '社团可见',
  private: '私密',
  public: '公开',
};

export function ClubStatusBadge({ status }: { status: PlatformClubStatus }) {
  const meta = clubStatus[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function UserStatusBadge({ status }: { status: PlatformUserStatus }) {
  const meta = userStatus[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function ContentStatusBadge({ status }: { status: PlatformContentStatus }) {
  const meta = contentStatus[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const meta = riskMeta[level];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function ReportStatusBadge({ status }: { status: PlatformReportStatus }) {
  const meta = reportStatus[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function SourceBadge({ source }: { source: RecordSource }) {
  const tone: Tone = source === 'import' ? 'blue' : source === 'activity' ? 'gold' : 'gray';
  return <Badge tone={tone}>{sourceLabels[source]}</Badge>;
}

export function VisibilityBadge({ visibility }: { visibility: RecordVisibility }) {
  const tone: Tone = visibility === 'private' ? 'gray' : visibility === 'public' ? 'blue' : 'green';
  return <Badge tone={tone}>{visibilityLabels[visibility]}</Badge>;
}

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
