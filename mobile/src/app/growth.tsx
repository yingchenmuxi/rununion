import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppHeader,
  Avatar,
  Card,
  DemoNote,
  Pill,
  ProgressBar,
  Screen,
  SectionTitle,
} from '@/components/qingrun-ui';
import { colors, mock, radius, space } from '@/constants/qingrun';
import { useActivities } from '@/features/activities/ActivityContext';
import { formatActivityDate } from '@/features/activities/activityData';
import { useChallenges } from '@/features/challenges/ChallengeContext';
import {
  CHALLENGE_STATUS_META,
  challengeProgressText,
  formatChallengeRange,
} from '@/features/challenges/challengeData';
import { RUN_SOURCE_LABELS, formatDuration, formatPace, formatRunDate, useRuns } from '@/features/runs/RunContext';

const LEVELS = ['区级', '市级', '省级', '全国'];

export default function GrowthScreen() {
  const router = useRouter();
  const { stats, recentRuns } = useRuns();
  const { myUpcoming, myPast, attendedCount, absentCount, checkinPendingCount } = useActivities();
  const { activeChallenge, upcomingChallenge, refresh: refreshChallenges } = useChallenges();
  const challenge = activeChallenge ?? upcomingChallenge;

  useFocusEffect(
    useCallback(() => {
      void refreshChallenges();
    }, [refreshChallenges]),
  );
  const lastActivity = myPast[0];
  const maxWeek = Math.max(1, ...stats.weeks.map((week) => week.km));
  const levelPercent = Math.min(100, Math.round((stats.monthKm / 25) * 100));
  const levelHint = stats.monthKm > 0
    ? '本月累计 ' + stats.monthKm.toFixed(1) + ' km，继续积累成长等级'
    : '完成第一次开跑，开始积累成长等级';

  return (
    <Screen>
      <AppHeader
        title="成长"
        subtitle="不追速度，只记录坚持。"
        right={<Avatar label={mock.user.initial} size={38} />}
      />

      <Card style={styles.summary}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryKicker}>本月成长</Text>
            <View style={styles.summaryValueRow}>
              <Text style={styles.summaryValue}>{stats.monthKm.toFixed(1)}</Text>
              <Text style={styles.summaryUnit}>km</Text>
            </View>
          </View>
          <Pill text={mock.user.level} tone="onDark" />
        </View>
        <View style={styles.summaryStats}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>{mock.week.streak} 周</Text>
            <Text style={styles.summaryStatLabel}>连续记录</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>{mock.badges.length} 枚</Text>
            <Text style={styles.summaryStatLabel}>成长徽章</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>{mock.week.rank > 0 ? '第 ' + mock.week.rank : '未上榜'}</Text>
            <Text style={styles.summaryStatLabel}>队内参与</Text>
          </View>
        </View>
      </Card>

      <SectionTitle title="活动参与" action="我的活动" onAction={() => router.push('/my-activities')} />
      <Card style={styles.activityCard}>
        <View style={styles.activityStats}>
          <View style={styles.activityStat}>
            <Text style={styles.activityStatValue}>{attendedCount}</Text>
            <Text style={styles.activityStatLabel}>已参加</Text>
          </View>
          <View style={styles.activityDivider} />
          <View style={styles.activityStat}>
            <Text style={styles.activityStatValue}>{absentCount}</Text>
            <Text style={styles.activityStatLabel}>未到</Text>
          </View>
          <View style={styles.activityDivider} />
          <View style={styles.activityStat}>
            <Text style={styles.activityStatValue}>{checkinPendingCount}</Text>
            <Text style={styles.activityStatLabel}>待核对</Text>
          </View>
          <View style={styles.activityDivider} />
          <View style={styles.activityStat}>
            <Text style={styles.activityStatValue}>{myUpcoming.length}</Text>
            <Text style={styles.activityStatLabel}>待参加</Text>
          </View>
        </View>
        {lastActivity ? (
          <View style={styles.lastActivity}>
            <View style={styles.lastActivityMark}><Text style={styles.lastActivityGlyph}>跑</Text></View>
            <View style={styles.lastActivityInfo}>
              <Text style={styles.lastActivityTitle}>{lastActivity.title}</Text>
              <Text style={styles.lastActivityMeta}>{formatActivityDate(lastActivity.dateISO)} · {lastActivity.distanceKm} km · {lastActivity.mySignup?.status === 'attended' ? '已参加' : lastActivity.mySignup?.status === 'absent' ? '未到' : '待核对'}</Text>
            </View>
            <Pill text="线下活动" tone="green" />
          </View>
        ) : (
          <Text style={styles.activityEmpty}>还没有线下活动记录，报名一场和跑团一起跑。</Text>
        )}
        <Text style={styles.activityNote}>活动参与只沉淀出勤与参与场次，不把活动距离重复计入跑量。</Text>
      </Card>

      <SectionTitle title="跑团挑战" action="全部挑战" onAction={() => router.push('/challenges')} />
      {challenge ? (
        <Card style={styles.challengeCard} onPress={() => router.push('/challenges')}>
          <View style={styles.challengeTop}>
            <Text style={styles.challengeTitle} numberOfLines={1}>{challenge.title}</Text>
            <Pill text={CHALLENGE_STATUS_META[challenge.status].label} tone={CHALLENGE_STATUS_META[challenge.status].tone} />
          </View>
          <View style={styles.challengeProgressRow}>
            <Text style={styles.challengeKm}>{challenge.myKm.toFixed(1)} / {challenge.targetKm} km</Text>
            <Text style={styles.challengePercent}>{challenge.myCompleted ? '已完成' : challenge.myPercent + '%'}</Text>
          </View>
          <ProgressBar value={challenge.myPercent} />
          <View style={styles.challengeFoot}>
            <Text style={styles.challengeHint}>{challengeProgressText(challenge)}</Text>
            <Text style={styles.challengeMeta}>
              {challenge.status === 'active'
                ? challenge.participantCount + ' 人参与 · ' + challenge.completedCount + ' 人完成'
                : formatChallengeRange(challenge.startDate, challenge.endDate)}
            </Text>
          </View>
          <Text style={styles.challengeNote}>只累计社团可见的跑步记录；活动出勤不重复计入，私密记录不计入。</Text>
        </Card>
      ) : (
        <Card style={styles.challengeCard}>
          <Text style={styles.challengeTitle}>还没有挑战</Text>
          <Text style={styles.challengeNote}>团长发布累计里程挑战后，会在这里看到目标和自己的进度。</Text>
        </Card>
      )}

      <SectionTitle title="个人最好" action="添加记录" />
      <View style={styles.pbGrid}>
        {mock.pbs.length === 0 ? (
          <Text style={styles.emptyText}>还没有个人最好成绩，完成一次计时跑后会记录在这里。</Text>
        ) : mock.pbs.map((pb) => {
          const pending = pb.result === '待记录';
          return (
            <Card key={pb.distance} style={styles.pbCard}>
              <Text style={styles.pbDistance}>{pb.distance}</Text>
              <Text style={[styles.pbResult, pending && styles.pbPending]}>{pb.result}</Text>
              <Text style={styles.pbNote}>{pb.note}</Text>
            </Card>
          );
        })}
      </View>

      <SectionTitle title="本月跑量" action="近 4 周" />
      <Card style={styles.chartCard}>
        <View style={styles.chartRow}>
          {stats.weeks.map((week) => (
            <View key={week.label} style={styles.barColumn}>
              <Text style={styles.barValue}>{week.km.toFixed(1)}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: 14 + Math.round((week.km / maxWeek) * 78) }]} />
              </View>
              <Text style={styles.barLabel}>{week.label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.chartNote}>按周记录，不看配速；断掉一周也不会清零，重新开始就好。</Text>
      </Card>

      <SectionTitle title="最近记录" action="去开跑" onAction={() => router.push('/run')} />
      <Card>
        {recentRuns.length === 0 ? (
          <Text style={styles.emptyText}>还没有跑步记录，完成第一次开跑后会出现在这里。</Text>
        ) : null}
        {recentRuns.slice(0, 5).map((run, index) => (
          <View key={run.id} style={[styles.runRow, index > 0 && styles.runRowLine]}>
            <View style={styles.runDate}>
              <Text style={styles.runDateText}>{formatRunDate(run.date)}</Text>
            </View>
            <View style={styles.runInfo}>
              <Text style={styles.runTitle}>{run.title}</Text>
              <Text style={styles.runMeta}>
                {run.distanceKm.toFixed(1)} km · {formatDuration(run.durationMin)} · {formatPace(run.distanceKm, run.durationMin)} · {RUN_SOURCE_LABELS[run.source]}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <SectionTitle title="团队成长榜" action="参与榜" />
      <Card style={styles.boardCard}>
        <View style={styles.boardHeader}>
          <Text style={styles.boardHeaderRank}>名次</Text>
          <Text style={styles.boardHeaderName}>班级 / 跑团</Text>
          <Text style={styles.boardHeaderKm}>本周</Text>
        </View>
        {mock.teamBoard.length === 0 ? (
          <Text style={styles.emptyText}>还没有团队数据，班级同学开始记录后会出现在这里。</Text>
        ) : mock.teamBoard.map((row) => (
          <View key={row.name} style={styles.boardRow}>
            <View style={[styles.rankBadge, row.rank === 1 && styles.rankBadgeFirst]}>
              <Text style={[styles.rankText, row.rank === 1 && styles.rankTextFirst]}>{row.rank}</Text>
            </View>
            <Text style={styles.boardName} numberOfLines={1}>{row.name}</Text>
            <Text style={styles.boardKm}>{row.km}</Text>
            <Text style={styles.boardTrend}>{row.trend}</Text>
          </View>
        ))}
        <Text style={styles.boardNote}>团队榜按参与人数与总里程统计，不按速度排名。</Text>
      </Card>

      <SectionTitle title="成长等级" />
      <Card style={styles.levelCard}>
        <View style={styles.levelTop}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>青</Text>
          </View>
          <View style={styles.levelInfo}>
            <Text style={styles.levelName}>{mock.user.level}</Text>
            <Text style={styles.levelHint}>{levelHint}</Text>
          </View>
          <Text style={styles.levelPercent}>{levelPercent}%</Text>
        </View>
        <ProgressBar value={levelPercent} />
        <Text style={styles.levelNote}>等级只看持续参与和完赛，不与配速、名次挂钩。</Text>
      </Card>

      <SectionTitle title="我的徽章" action="全部" />
      <View style={styles.badgeRow}>
        {mock.badges.length === 0 ? (
          <Text style={styles.emptyText}>还没有徽章，连续记录和完成挑战会点亮徽章。</Text>
        ) : mock.badges.map((badge) => (
          <View key={badge.label} style={styles.badgeItem}>
            <View style={styles.badgeCircle}>
              <Text style={styles.badgeGlyph}>★</Text>
            </View>
            <Text style={styles.badgeLabel}>{badge.label}</Text>
          </View>
        ))}
      </View>

      <Card style={styles.levelsCard}>
        <View style={styles.levelsTop}>
          <Text style={styles.levelsTitle}>四级成长榜</Text>
          <Pill text="记录成长" tone="gold" />
        </View>
        <View style={styles.levelChips}>
          {LEVELS.map((level, index) => (
            <View key={level} style={[styles.levelChip, index === 0 && styles.levelChipActive]}>
              <Text style={[styles.levelChipText, index === 0 && styles.levelChipTextActive]}>{level}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.levelsBody}>
          正式版按年龄段、男子 / 女子组别与项目分榜，覆盖 1500 米到全程马拉松。当前处于校级试点阶段，区级及以上榜单待跑团数量达标后开放。
        </Text>
      </Card>

      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { padding: space.lg, backgroundColor: colors.brand, borderColor: colors.brand },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  summaryKicker: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  summaryValueRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 },
  summaryValue: { fontSize: 42, lineHeight: 48, fontWeight: '800', color: colors.white },
  summaryUnit: { marginLeft: 5, marginBottom: 7, fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  summaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  summaryStat: { flex: 1, alignItems: 'flex-start' },
  summaryStatValue: { fontSize: 16, fontWeight: '800', color: colors.white },
  summaryStatLabel: { marginTop: 2, fontSize: 10, color: 'rgba(255,255,255,0.66)' },
  summaryDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.14)' },
  activityCard: { padding: space.lg },
  activityStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activityStat: { flex: 1, alignItems: 'flex-start' },
  activityStatValue: { fontSize: 20, fontWeight: '800', color: colors.brand },
  activityStatLabel: { marginTop: 2, fontSize: 10, color: colors.muted },
  activityDivider: { width: 1, height: 28, backgroundColor: colors.line },
  lastActivity: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  lastActivityMark: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  lastActivityGlyph: { fontSize: 13, fontWeight: '800', color: colors.brand },
  lastActivityInfo: { flex: 1, gap: 2 },
  lastActivityTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  lastActivityMeta: { fontSize: 10, color: colors.muted },
  activityEmpty: { marginTop: 12, fontSize: 12, color: colors.muted },
  activityNote: { marginTop: 10, fontSize: 10, lineHeight: 16, color: colors.muted },
  challengeCard: { padding: space.lg, marginTop: 10 },
  challengeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  challengeTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.ink },
  challengeProgressRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12, marginBottom: 7 },
  challengeKm: { fontSize: 14, fontWeight: '800', color: colors.brand },
  challengePercent: { fontSize: 11, fontWeight: '700', color: colors.muted },
  challengeFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  challengeHint: { fontSize: 11, fontWeight: '700', color: colors.inkSoft },
  challengeMeta: { flexShrink: 1, textAlign: 'right', fontSize: 10, color: colors.muted },
  challengeNote: { marginTop: 9, fontSize: 10, lineHeight: 16, color: colors.muted },
  pbGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  pbCard: { width: '48%', padding: 14 },
  pbDistance: { fontSize: 11, fontWeight: '700', color: colors.muted },
  pbResult: { marginTop: 5, fontSize: 22, fontWeight: '800', color: colors.brand },
  pbPending: { fontSize: 16, color: colors.muted },
  pbNote: { marginTop: 3, fontSize: 10, color: colors.muted },
  chartCard: { padding: space.lg },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 132 },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  barValue: { fontSize: 10, fontWeight: '700', color: colors.inkSoft },
  barTrack: { width: 30, height: 96, justifyContent: 'flex-end', borderRadius: 8, backgroundColor: colors.bg },
  barFill: { width: 30, borderRadius: 8, backgroundColor: colors.brand },
  barLabel: { fontSize: 9, color: colors.muted },
  chartNote: { marginTop: 10, fontSize: 10, lineHeight: 16, color: colors.muted },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  runRowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  runDate: { width: 66 },
  runDateText: { fontSize: 10, color: colors.muted },
  runInfo: { flex: 1, gap: 3 },
  runTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  runMeta: { fontSize: 10, color: colors.muted },
  boardCard: { padding: space.lg },
  boardHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  boardHeaderRank: { width: 34, fontSize: 9, color: colors.muted },
  boardHeaderName: { flex: 1, fontSize: 9, color: colors.muted },
  boardHeaderKm: { width: 58, textAlign: 'right', fontSize: 9, color: colors.muted },
  boardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankBadgeFirst: { backgroundColor: colors.goldSoft },
  rankText: { fontSize: 10, fontWeight: '800', color: colors.muted },
  rankTextFirst: { color: colors.gold },
  boardName: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.ink },
  boardKm: { width: 58, textAlign: 'right', fontSize: 11, fontWeight: '700', color: colors.inkSoft },
  boardTrend: { width: 42, textAlign: 'right', fontSize: 9, color: colors.brand },
  boardNote: { marginTop: 8, fontSize: 10, lineHeight: 16, color: colors.muted },
  levelCard: { padding: space.lg },
  levelTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  levelBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: { fontSize: 17, fontWeight: '800', color: colors.brand },
  levelInfo: { flex: 1, gap: 3 },
  levelName: { fontSize: 14, fontWeight: '800', color: colors.ink },
  levelHint: { fontSize: 10, color: colors.muted },
  levelPercent: { fontSize: 13, fontWeight: '800', color: colors.brand },
  levelNote: { marginTop: 9, fontSize: 10, lineHeight: 16, color: colors.muted },
  badgeRow: { flexDirection: 'row', gap: 10 },
  badgeItem: { flex: 1, alignItems: 'center', gap: 5 },
  badgeCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlyph: { fontSize: 18, color: colors.gold },
  badgeLabel: { fontSize: 9, color: colors.muted, textAlign: 'center' },
  levelsCard: { marginTop: 16, padding: space.lg },
  levelsTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelsTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  levelChips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  levelChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  levelChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  levelChipText: { fontSize: 11, fontWeight: '700', color: colors.muted },
  levelChipTextActive: { color: colors.white },
  levelsBody: { marginTop: 10, fontSize: 10, lineHeight: 17, color: colors.muted },
  emptyText: { flex: 1, fontSize: 12, lineHeight: 19, color: colors.muted, paddingVertical: 8 },
});