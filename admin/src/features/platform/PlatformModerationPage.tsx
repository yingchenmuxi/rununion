import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformRepository } from '../../data';
import { formatDateTime, relativeTime } from '../../lib/format';
import { useToast } from '../../components/ui/Toast';
import { Button, Card, EmptyState, Field, PageHeader, Spinner } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { Modal } from '../../components/ui/Modal';
import type { PlatformReport, PlatformReportStatus } from '../../types/models';
import { ReportStatusBadge, reportTargetLabels } from './platformUi';

type StatusFilter = 'all' | PlatformReportStatus;

interface ReviewState {
  report: PlatformReport;
  mode: 'resolve' | 'dismiss';
  note: string;
}

const targetRoute: Record<PlatformReport['targetType'], string> = {
  user: '/platform/users/',
  club: '/platform/clubs/',
  content: '/platform/content',
  record: '/platform/records',
};

const quickNotes = [
  '已联系社团负责人核实，要求限期整改并补充材料。',
  '内容/记录已下线或更正，并通知相关成员。',
  '未发现违规，举报不成立，已向举报人说明。',
];

export function PlatformModerationPage() {
  const toast = useToast();
  const [reports, setReports] = useState<PlatformReport[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setReports(await platformRepository.listReports());
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    all: reports.length,
    pending: reports.filter((item) => item.status === 'pending').length,
    resolved: reports.filter((item) => item.status === 'resolved').length,
    dismissed: reports.filter((item) => item.status === 'dismissed').length,
    high: reports.filter((item) => item.status === 'pending' && item.priority === 'high').length,
  }), [reports]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return reports
      .filter((item) => {
        if (filter !== 'all' && item.status !== filter) return false;
        if (!needle) return true;
        return [item.id, item.targetName, item.clubName, item.reason, item.detail, item.reporter].join(' ').toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        return Number(b.priority === 'high') - Number(a.priority === 'high') || b.createdAt.localeCompare(a.createdAt);
      });
  }, [reports, filter, query]);

  const submit = async () => {
    if (!review) return;
    const note = review.note.trim();
    if (review.mode === 'resolve' && !note) {
      toast('处理举报必须填写处理说明，方便后续追溯。', 'error');
      return;
    }
    setBusy(true);
    try {
      if (review.mode === 'resolve') {
        await platformRepository.resolveReport(review.report.id, note);
        toast('举报已处理，说明和操作人已写入审计日志。');
      } else {
        await platformRepository.dismissReport(review.report.id, note || undefined);
        toast('举报已驳回，结论已留痕。');
      }
      setReview(null);
      await load();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '操作失败，请稍后重试。', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="正在读取举报队列" />;

  const filters: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'pending', label: '待处理', count: counts.pending },
    { key: 'resolved', label: '已处理', count: counts.resolved },
    { key: 'dismissed', label: '已驳回', count: counts.dismissed },
    { key: 'all', label: '全部', count: counts.all },
  ];

  return (
    <>
      <PageHeader
        title="审核与举报"
        description="高风险优先处理。每一次处理都要写清依据和后续动作，平台会保留完整记录。"
        actions={<span className="soft-chip"><Icon name="alert" size={14} /> {counts.high} 条高风险待处理</span>}
      />

      {counts.high > 0 ? (
        <div className="info-banner info-banner-warn">
          <span className="info-banner-icon"><Icon name="alert" size={17} /></span>
          <div><strong>先处理高风险</strong><p>涉及未成年人隐私、线下活动安全、代跑或商业招生的举报，建议在 24 小时内给出明确结论。</p></div>
        </div>
      ) : null}

      <div className="stat-grid">
        <Card className="stat-card"><span className="stat-icon stat-icon-gold"><Icon name="clock" size={19} /></span><div className="stat-copy"><span>待处理</span><strong>{counts.pending}</strong><small>含 {counts.high} 条高风险</small></div></Card>
        <Card className="stat-card"><span className="stat-icon stat-icon-green"><Icon name="check" size={19} /></span><div className="stat-copy"><span>已处理</span><strong>{counts.resolved}</strong><small>有处理说明</small></div></Card>
        <Card className="stat-card"><span className="stat-icon stat-icon-gray"><Icon name="x" size={19} /></span><div className="stat-copy"><span>已驳回</span><strong>{counts.dismissed}</strong><small>举报不成立</small></div></Card>
        <Card className="stat-card"><span className="stat-icon stat-icon-blue"><Icon name="shield" size={19} /></span><div className="stat-copy"><span>处理留痕</span><strong>{counts.resolved + counts.dismissed}</strong><small>全部写入日志</small></div></Card>
      </div>

      <Card className="table-card">
        <div className="table-toolbar">
          <div className="filter-tabs">
            {filters.map((item) => (
              <button key={item.key} type="button" className={'filter-tab' + (filter === item.key ? ' filter-tab-active' : '')} onClick={() => setFilter(item.key)}>
                {item.label}<span>{item.count}</span>
              </button>
            ))}
          </div>
          <div className="search-box">
            <Icon name="search" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索对象、社团、原因或举报人" />
          </div>
        </div>

        {rows.length === 0 ? <EmptyState icon="check" title="这里已经清空了" description="当前筛选下没有待处理事项，可以切换到其他状态查看历史记录。" /> : (
          <div className="report-list">
            {rows.map((report) => (
              <article className="report-card" key={report.id}>
                <div className="report-head">
                  <div className="report-title-wrap">
                    <span className={'report-dot report-dot-' + report.priority} />
                    <div>
                      <div className="report-title-row">
                        <strong>{report.reason}</strong>
                        {report.priority === 'high' ? <span className="risk-flag">高风险</span> : null}
                        <ReportStatusBadge status={report.status} />
                      </div>
                      <p className="report-sub">
                        {reportTargetLabels[report.targetType]} · {report.targetName} · {report.clubName} · {formatDateTime(report.createdAt)}（{relativeTime(report.createdAt)}）
                      </p>
                    </div>
                  </div>
                  <span className="report-id">{report.id}</span>
                </div>

                <p className="report-detail">{report.detail}</p>

                <div className="report-foot">
                  <span className="muted-cell">举报人：{report.reporter}</span>
                  <div className="row-actions">
                    {report.status === 'pending' ? (
                      <>
                        <Button size="sm" variant="primary" onClick={() => setReview({ report, mode: 'resolve', note: '' })}>处理并留痕</Button>
                        <Button size="sm" variant="ghost" onClick={() => setReview({ report, mode: 'dismiss', note: '' })}>驳回</Button>
                      </>
                    ) : (
                      <Link to={targetRoute[report.targetType]} className="text-link">查看对象</Link>
                    )}
                  </div>
                </div>

                {report.resolution ? (
                  <div className="report-resolution"><strong>处理说明</strong><span>{report.resolution}</span></div>
                ) : null}
              </article>
            ))}
          </div>
        )}
        <div className="table-footnote">举报处理意见对平台管理员可见；涉及未成年人的材料不在这里公开展示。</div>
      </Card>

      <Modal
        open={review !== null}
        title={review?.mode === 'resolve' ? '处理这条举报' : '驳回这条举报'}
        description={review ? review.report.reason + ' · ' + review.report.targetName : undefined}
        onClose={() => setReview(null)}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setReview(null)}>取消</Button>
            <Button variant={review?.mode === 'resolve' ? 'primary' : 'danger'} loading={busy} onClick={submit}>
              {review?.mode === 'resolve' ? '确认处理' : '确认驳回'}
            </Button>
          </>
        )}
      >
        {review ? (
          <div className="review-form">
            <div className="review-context">
              <p>{review.report.detail}</p>
              <span>{review.report.clubName} · 举报人 {review.report.reporter} · {formatDateTime(review.report.createdAt)}</span>
            </div>
            <Field
              label={review.mode === 'resolve' ? '处理说明' : '驳回说明'}
              required={review.mode === 'resolve'}
              hint={review.mode === 'resolve' ? '写清核实过程、已采取的动作和后续要求。' : '可选填，建议写明举报不成立的原因。'}
            >
              <textarea
                className="input textarea"
                rows={5}
                value={review.note}
                onChange={(event) => setReview({ ...review, note: event.target.value })}
                placeholder={review.mode === 'resolve' ? '例如：已联系社团负责人，确认记录为误填，已更正并通知成员。' : '例如：核对后未发现违规，已向举报人说明。'}
              />
            </Field>
            <div className="chip-row">
              {quickNotes.map((note) => (
                <button key={note} type="button" className="soft-chip soft-chip-button" onClick={() => setReview({ ...review, note })}>{note}</button>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
