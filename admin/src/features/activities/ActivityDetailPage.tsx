import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { repository } from '../../data';
import { useAsync } from '../../lib/useAsync';
import { relativeTime } from '../../lib/format';
import type { ActivitySignup, ActivitySignupStatus } from '../../types/models';
import { Avatar, Badge, Button, Card, EmptyState, Spinner } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { DetailHeader, DetailTabs } from '../../components/ui/detail';
import { ActivityStatusBadge, ActivityTagBadge, SignupStatusBadge, formatActivityDate } from './activityUi';

type TabKey = 'signups' | 'info';
type Filter = 'all' | ActivitySignupStatus;
type Decision = 'approved' | 'declined';
type ConfirmAction = 'publish' | 'end';

interface ReviewTarget {
  signup: ActivitySignup;
  decision: Decision;
}

export function ActivityDetailPage() {
  const { activityId } = useParams<{ activityId: string }>();
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>('signups');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [review, setReview] = useState<ReviewTarget | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [consentTarget, setConsentTarget] = useState<ActivitySignup | null>(null);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!activityId) return null;
    const activity = await repository.getActivity(activityId);
    if (!activity) return null;
    const signups = await repository.listActivitySignups(activity.id);
    return { activity, signups };
  }, [activityId]);

  const counts = useMemo(() => {
    const rows = data?.signups ?? [];
    return {
      all: rows.length,
      pending: rows.filter((row) => row.status === 'pending').length,
      approved: rows.filter((row) => row.status === 'approved').length,
      declined: rows.filter((row) => row.status === 'declined').length,
      attended: rows.filter((row) => row.status === 'attended').length,
      active: rows.filter((row) => row.status !== 'declined').length,
      confirmed: rows.filter((row) => row.status === 'approved' || row.status === 'attended').length,
    };
  }, [data]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return (data?.signups ?? []).filter((row) => {
      const matchesFilter = filter === 'all' || row.status === filter;
      const matchesQuery = !keyword || [row.memberName, row.grade, row.guardianName, row.guardianPhone]
        .some((value) => value.toLowerCase().includes(keyword));
      return matchesFilter && matchesQuery;
    });
  }, [data, filter, query]);

  if (loading && !data) return <Spinner label="正在加载活动" />;
  if (error) {
    return (
      <Card className="error-card">
        <span className="error-icon"><Icon name="alert" size={22} /></span>
        <div><h3>活动加载失败</h3><p>{error}</p></div>
        <Button variant="secondary" onClick={reload}>重新加载</Button>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card className="error-card">
        <span className="error-icon"><Icon name="alert" size={22} /></span>
        <div><h3>没有找到这场活动</h3><p>活动可能已被删除，或链接里的编号不对。</p></div>
        <Link to="/activities" className="btn btn-secondary btn-md"><span>返回活动列表</span></Link>
      </Card>
    );
  }

  const { activity, signups } = data;
  const full = counts.confirmed >= activity.capacity;
  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'all', label: '全部', count: counts.all },
    { key: 'pending', label: '待确认', count: counts.pending },
    { key: 'approved', label: '已确认', count: counts.approved },
    { key: 'attended', label: '已参加', count: counts.attended },
    { key: 'declined', label: '已取消', count: counts.declined },
  ];

  const openReview = (signup: ActivitySignup, decision: Decision) => {
    setReview({ signup, decision });
    setReviewNote('');
    setReviewError(null);
  };

  const submitReview = async () => {
    if (!review) return;
    if (review.decision === 'declined' && reviewNote.trim().length < 2) {
      setReviewError('请写一句取消原因，成员端会看到。');
      return;
    }
    setBusy(true);
    setReviewError(null);
    try {
      await repository.reviewActivitySignup(review.signup.id, review.decision, reviewNote.trim() || undefined);
      toast(review.decision === 'approved'
        ? review.signup.memberName + ' 的报名已确认，集合点已开放。'
        : '报名已取消，名额已退回。');
      setReview(null);
      reload();
    } catch (reason) {
      setReviewError(reason instanceof Error ? reason.message : '处理失败，请稍后再试。');
    } finally {
      setBusy(false);
    }
  };

  const recordConsent = async () => {
    if (!consentTarget) return;
    setBusy(true);
    try {
      await repository.recordGuardianConsent(consentTarget.id);
      toast('已登记 ' + consentTarget.memberName + ' 的监护人同意。', 'info');
      setConsentTarget(null);
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '登记失败。', 'error');
    } finally {
      setBusy(false);
    }
  };

  const runActivityAction = async () => {
    if (!confirmAction) return;
    setBusy(true);
    try {
      if (confirmAction === 'publish') {
        await repository.publishActivity(activity.id);
        toast('活动已发布，成员端现在可以报名。');
      } else {
        await repository.endActivity(activity.id);
        toast('活动已结束，未确认的报名已自动关闭。', 'info');
      }
      setConfirmAction(null);
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '操作失败。', 'error');
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { key: 'signups', label: '报名名单', count: counts.all },
    { key: 'info', label: '活动信息' },
  ];

  return (
    <div>
      <DetailHeader
        backTo="/activities"
        backLabel="返回活动列表"
        title={activity.title}
        badges={(
          <>
            <ActivityStatusBadge status={activity.status} />
            <ActivityTagBadge tag={activity.tag} />
          </>
        )}
        subtitle={(
          <>
            {formatActivityDate(activity.date)} {activity.startTime} · {activity.meetingArea} · {activity.distanceKm} km · {activity.coach}
          </>
        )}
        actions={activity.status === 'draft' ? (
          <Button variant="primary" icon="send" onClick={() => setConfirmAction('publish')}>发布活动</Button>
        ) : activity.status === 'published' ? (
          <Button variant="dangerGhost" onClick={() => setConfirmAction('end')}>结束活动</Button>
        ) : (
          <span className="soft-chip">活动已结束，报名只读</span>
        )}
      />

      <section className="detail-summary">
        <div><span>报名人数</span><strong>{counts.active} / {activity.capacity}</strong><small>不含已取消</small></div>
        <div><span>待确认</span><strong>{counts.pending}</strong><small>需要团长处理</small></div>
        <div><span>已确认</span><strong>{counts.confirmed}</strong><small>含已参加</small></div>
        <div><span>距离</span><strong>{activity.distanceKm} km</strong><small>约 {activity.durationMin} 分钟</small></div>
        <div><span>集合</span><strong>{activity.startTime}</strong><small>{formatActivityDate(activity.date)}</small></div>
      </section>

      <DetailTabs tabs={tabs} active={tab} onChange={(key) => setTab(key as TabKey)} />

      {tab === 'signups' ? (
        <Card className="table-card">
          <div className="table-toolbar">
            <div className="filter-tabs" role="tablist" aria-label="报名状态筛选">
              {filters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.key}
                  className={'filter-tab' + (filter === item.key ? ' filter-tab-active' : '')}
                  onClick={() => setFilter(item.key)}
                >
                  {item.label}<span>{item.count}</span>
                </button>
              ))}
            </div>
            <div className="search-box">
              <Icon name="search" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索成员、年级或监护人"
                aria-label="搜索报名"
              />
            </div>
          </div>

          {full && activity.status === 'published' ? (
            <div className="inline-warning">
              <Icon name="alert" size={16} />
              <span>名额已满（{counts.confirmed} / {activity.capacity}），待确认的报名不能再通过。</span>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <EmptyState
              icon="users"
              title={query ? '没有匹配的报名' : '这个分组还没有报名'}
              description={query ? '换一个关键词试试。' : '成员在手机端提交报名后，会先出现在待确认里。'}
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table signup-table">
                <thead>
                  <tr>
                    <th>成员</th>
                    <th>年级 / 性别</th>
                    <th>监护人</th>
                    <th>提交时间</th>
                    <th>状态</th>
                    <th className="align-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((signup) => (
                    <tr key={signup.id}>
                      <td>
                        <div className="person-cell">
                          <Avatar name={signup.memberName} size="sm" tone={signup.status === 'pending' ? 'gold' : 'green'} />
                          <div>
                            <div className="person-name">{signup.memberName}</div>
                            <span>{signup.note || '未填写备注'}</span>
                          </div>
                        </div>
                      </td>
                      <td>{signup.grade} · {signup.gender}</td>
                      <td>
                        <div className="stacked-cell">
                          <strong>{signup.guardianName}</strong>
                          <span>{signup.guardianPhone}</span>
                          <span>
                            {signup.guardianConsent
                              ? <Badge tone="green">同意已登记</Badge>
                              : <Badge tone="gold">待补登记</Badge>}
                          </span>
                        </div>
                      </td>
                      <td className="muted-cell">{relativeTime(signup.createdAt)}</td>
                      <td>
                        <div className="stacked-cell">
                          <SignupStatusBadge status={signup.status} />
                          {signup.reviewNote ? <span className="signup-note">{signup.reviewNote}</span> : null}
                        </div>
                      </td>
                      <td>
                        <div className="row-actions">
                          {signup.status === 'pending' && activity.status === 'published' ? (
                            <>
                              {!signup.guardianConsent ? (
                                <Button variant="secondary" size="sm" onClick={() => setConsentTarget(signup)}>补登记同意</Button>
                              ) : null}
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={!signup.guardianConsent || full}
                                title={!signup.guardianConsent ? '先补登记监护人同意' : full ? '名额已满' : '确认报名'}
                                onClick={() => openReview(signup, 'approved')}
                              >
                                通过
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openReview(signup, 'declined')}>取消</Button>
                            </>
                          ) : signup.status === 'pending' ? (
                            <span className="muted-cell">活动不在报名中</span>
                          ) : (
                            <span className="muted-cell">已处理</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="table-footnote">
            共 {signups.length} 条报名。通过前必须登记监护人同意；确认后成员才能看到具体集合点。
          </p>
        </Card>
      ) : (
        <div className="split-grid">
          <div className="stacked-panels">
            <Card className="table-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">活动信息</h2>
                  <p className="section-desc">成员端展示的基础信息；具体位置只在确认后开放。</p>
                </div>
                <ActivityStatusBadge status={activity.status} />
              </div>
              <div className="info-grid">
                <div className="info-item"><span>日期</span><strong>{formatActivityDate(activity.date)}</strong></div>
                <div className="info-item"><span>集合时间</span><strong>{activity.startTime}</strong></div>
                <div className="info-item"><span>集合地点</span><strong>{activity.meetingArea}</strong></div>
                <div className="info-item"><span>具体位置</span><strong>{activity.meetingDetail || '未填写'}</strong></div>
                <div className="info-item"><span>距离 / 时长</span><strong>{activity.distanceKm} km · 约 {activity.durationMin} 分钟</strong></div>
                <div className="info-item"><span>带跑教练</span><strong>{activity.coach}</strong></div>
                <div className="info-item"><span>强度</span><strong>{activity.intensity}</strong></div>
                <div className="info-item"><span>人数上限</span><strong>{activity.capacity} 人</strong></div>
              </div>
              <div className="detail-block">
                <h3>活动安排</h3>
                <p>{activity.description}</p>
              </div>
              {activity.preparation.length > 0 ? (
                <div className="detail-block">
                  <h3>出发前准备</h3>
                  <ul className="checklist">
                    {activity.preparation.map((item) => (
                      <li key={item}>
                        <Icon name="check" size={15} className="check-ok" />
                        <div>{item}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {activity.notes ? (
                <div className="detail-block">
                  <h3>天气与安全备注</h3>
                  <p>{activity.notes}</p>
                </div>
              ) : null}
            </Card>
          </div>

          <div className="stacked-panels">
            <Card className="table-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">报名规则</h2>
                  <p className="section-desc">未成年人参加线下活动，需要监护人知情。</p>
                </div>
              </div>
              <ul className="checklist">
                <li><Icon name="check" size={15} className="check-ok" /><div>提交报名后先进入待确认，不等于已被放行。</div></li>
                <li><Icon name="check" size={15} className="check-ok" /><div>监护人同意未登记时，不能确认报名。</div></li>
                <li><Icon name="check" size={15} className="check-ok" /><div>确认后才显示具体集合点，取消后重新隐藏。</div></li>
                <li><Icon name="check" size={15} className="check-ok" /><div>名额满后停止确认；活动结束会自动关闭未处理报名。</div></li>
              </ul>
              <div className="detail-block">
                <h3>成员端会看到</h3>
                <p>活动标题、日期、集合区域、距离、强度和准备清单。具体位置、教练联系方式只在确认后开放。</p>
              </div>
            </Card>

            <Card className="table-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">当前状态</h2>
                  <p className="section-desc">活动状态会影响报名和名单操作。</p>
                </div>
              </div>
              <div className="info-grid activity-status-grid">
                <div className="info-item"><span>活动状态</span><strong>{activity.status === 'published' ? '报名中' : activity.status === 'draft' ? '草稿，成员端不可见' : '已结束，名单只读'}</strong></div>
                <div className="info-item"><span>报名情况</span><strong>{counts.active} 人报名 · {counts.pending} 人待确认</strong></div>
              </div>
              {activity.status === 'draft' ? (
                <div className="detail-block">
                  <p>草稿不会出现在成员端。确认信息无误后，再发布活动。</p>
                  <Button variant="primary" size="sm" icon="send" onClick={() => setConfirmAction('publish')}>发布活动</Button>
                </div>
              ) : activity.status === 'published' ? (
                <div className="detail-block">
                  <p>结束后不能再处理报名，未确认的报名会自动取消。</p>
                  <Button variant="dangerGhost" size="sm" onClick={() => setConfirmAction('end')}>结束活动</Button>
                </div>
              ) : (
                <div className="detail-block"><p>活动已结束，报名名单保留为历史记录。</p></div>
              )}
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(review)}
        title={review?.decision === 'approved' ? '确认这条报名？' : '取消这条报名？'}
        description={review?.decision === 'approved'
          ? '确认后成员会看到具体集合点，名额同时被占用。'
          : '取消后名额会立刻退回，成员端会看到取消状态。'}
        size="sm"
        onClose={() => { if (!busy) setReview(null); }}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setReview(null)} disabled={busy}>返回</Button>
            <Button
              variant={review?.decision === 'approved' ? 'primary' : 'danger'}
              onClick={submitReview}
              loading={busy}
              disabled={review?.decision === 'approved' && (!review.signup.guardianConsent || full)}
            >
              {review?.decision === 'approved' ? '确认报名' : '确认取消'}
            </Button>
          </>
        )}
      >
        {review ? (
          <div className="review-form">
            <div className="review-context">
              <p>{review.signup.memberName} · {review.signup.grade} · {review.signup.gender}</p>
              <span>监护人 {review.signup.guardianName} · {review.signup.guardianPhone}</span>
              <span>{review.signup.guardianConsent ? '监护人同意已登记' : '监护人同意未登记'}</span>
            </div>
            {review.decision === 'approved' && !review.signup.guardianConsent ? (
              <div className="inline-warning">
                <Icon name="alert" size={16} />
                <span>还没登记监护人同意。先在名单里补登记，再回来确认报名。</span>
              </div>
            ) : null}
            {review.decision === 'approved' && full ? (
              <div className="inline-warning">
                <Icon name="alert" size={16} />
                <span>名额已满（{counts.confirmed} / {activity.capacity}），不能再确认新的报名。</span>
              </div>
            ) : null}
            <label className="field-label" htmlFor="review-note">
              {review.decision === 'approved' ? '确认备注（选填）' : '取消原因（必填）'}
            </label>
            <textarea
              id="review-note"
              className="input textarea"
              rows={3}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder={review.decision === 'approved' ? '例如：已电话联系监护人确认' : '例如：监护人临时有事，本次不参加'}
              maxLength={160}
            />
            {reviewError ? (
              <div className="form-error"><Icon name="alert" size={16} /><span>{reviewError}</span></div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(consentTarget)}
        title="登记监护人同意？"
        description={(consentTarget?.memberName ?? '这位成员') + ' 的监护人已了解活动时间、集合地点和安全说明，并同意参加。登记后还需要团长单独确认报名。'}
        confirmText="已联系监护人"
        loading={busy}
        onConfirm={recordConsent}
        onClose={() => { if (!busy) setConsentTarget(null); }}
      />

      <ConfirmDialog
        open={confirmAction === 'publish'}
        title="发布这场活动？"
        description="发布后，社团成员会在手机端看到活动并可以提交报名。报名仍需要团长确认。"
        confirmText="发布活动"
        loading={busy}
        onConfirm={runActivityAction}
        onClose={() => { if (!busy) setConfirmAction(null); }}
      />

      <ConfirmDialog
        open={confirmAction === 'end'}
        title="结束这场活动？"
        description="结束后不能再处理报名，所有待确认的报名会自动取消，名单转为只读。"
        confirmText="结束活动"
        tone="danger"
        loading={busy}
        onConfirm={runActivityAction}
        onClose={() => { if (!busy) setConfirmAction(null); }}
      />
    </div>
  );
}
