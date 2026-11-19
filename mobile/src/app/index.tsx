import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Avatar,
  Card,
  DemoNote,
  Pill,
  PrimaryButton,
  ProgressBar,
  Screen,
  SectionTitle,
  Stat,
} from '@/components/qingrun-ui';
import { colors, mock, radius, space } from '@/constants/qingrun';
import { formatActivityDay } from '@/features/activities/activityData';
import { useActivities } from '@/features/activities/ActivityContext';
import { useAuth } from '@/features/auth/AuthContext';
import { FEATURED_ARTICLE } from '@/features/knowledge/knowledgeData';
import { RUN_SOURCE_LABELS, formatDuration, formatPace, formatRunDate, useRuns } from '@/features/runs/RunContext';

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { stats, recentRuns } = useRuns();
  const { upcomingActivities, getSignupStatus, signupCount } = useActivities();
  const nextActivity = upcomingActivities[0];
  const nextStatus = nextActivity ? getSignupStatus(nextActivity.id) : undefined;
  const nextLabel =
    nextStatus === 'pending' ? '待确认' : nextStatus === 'confirmed' ? '已报名' : '报名';
  const displayName = profile?.nickname ?? mock.user.name;
  const initial = displayName.slice(0, 1);
  const weekKm = stats.weekKm;
  const goalGap = Math.max(0, stats.weekGoal - weekKm);
  const weekPercent = stats.weekPercent;

  return (
    <Screen>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>青</Text>
          </View>
          <Text style={styles.brandName}>青跑团</Text>
        </View>
        <Pressable onPress={() => router.push('/profile')} hitSlop={8}>
          <Avatar label={initial} size={38} />
        </Pressable>
      </View>

      <Text style={styles.hello}>你好，{displayName}</Text>
      <Text style={styles.tagline}>不追速度，只记录坚持。</Text>

      <View style={styles.hero}>
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>本周跑量</Text>
          <Pill text={'目标 ' + stats.weekGoal + ' km'} tone="onDark" />
        </View>
        <View style={styles.heroValueRow}>
          <Text style={styles.heroValue}>{weekKm.toFixed(1)}</Text>
          <Text style={styles.heroUnit}>km</Text>
        </View>
        <ProgressBar value={weekPercent} tone="onDark" />
        <View style={styles.heroBottom}>
          <Text style={styles.heroHint}>
            {goalGap > 0 ? '还差 ' + goalGap.toFixed(1) + ' km 达成本周目标' : '本周目标已完成，保持轻松跑就好。'}
          </Text>
          <Text style={styles.heroHintStrong}>{weekPercent}%</Text>
        </View>
        <View style={styles.heroStats}>
          <Stat value={mock.week.streak + ' 周'} label="连续记录" tone="onDark" />
          <View style={styles.heroDivider} />
          <Stat value={stats.monthKm.toFixed(1)} label="本月 km" tone="onDark" />
          <View style={styles.heroDivider} />
          <Stat value={'第 ' + mock.week.rank} label="队内参与" tone="onDark" />
        </View>
      </View>

      <View style={styles.quickRow}>
        <PrimaryButton
          label="记录跑步"
          glyph="▶"
          onPress={() => router.push('/run')}
          style={styles.quickPrimary}
        />
        <PrimaryButton
          label="找跑团"
          variant="light"
          glyph="团"
          onPress={() => router.push('/school')}
          style={styles.quickSecondary}
        />
        <PrimaryButton
          label="看活动"
          variant="light"
          glyph="日"
          onPress={() => router.push('/activities')}
          style={styles.quickSecondary}
        />
      </View>

      <SectionTitle title="我的跑团" action="进入跑团" onAction={() => router.push('/school')} />
      <Card>
        <View style={styles.clubTop}>
          <View style={styles.clubBadge}>
            <Text style={styles.clubBadgeText}>{mock.club.short.slice(0, 1)}</Text>
          </View>
          <View style={styles.clubInfo}>
            <View style={styles.clubNameRow}>
              <Text style={styles.clubName} numberOfLines={1}>
                {mock.club.name}
              </Text>
              <Pill text="已认证" tone="green" />
            </View>
            <Text style={styles.clubMeta}>
              {mock.club.members} 名成员 · 本周 {mock.club.weekKm} km
            </Text>
          </View>
        </View>
        <View style={styles.memberRow}>
          <View style={styles.avatars}>
            {['林', '周', '陈', '许'].map((name, index) => (
              <View key={name} style={[styles.avatarStack, index > 0 && styles.avatarStackOverlap]}>
                <Avatar label={name} size={30} tone={index} />
              </View>
            ))}
            <View style={[styles.avatarStack, styles.avatarStackOverlap, styles.avatarMore]}>
              <Text style={styles.avatarMoreText}>+124</Text>
            </View>
          </View>
          <Text style={styles.clubNote}>本周一起跑了 {mock.club.weekKm} km</Text>
        </View>
      </Card>

      <SectionTitle title="本周活动" action="全部活动" onAction={() => router.push('/activities')} />
      {nextActivity ? (
        <Card onPress={() => router.push('/activity/' + nextActivity.id)} style={styles.activityCard}>
          <View style={styles.dateBlock}>
            <Text style={styles.dateDay}>{formatActivityDay(nextActivity.dateISO)}</Text>
            <Text style={styles.dateTime}>{nextActivity.startTime}</Text>
          </View>
          <View style={styles.activityInfo}>
            <Text style={styles.activityTitle}>{nextActivity.title}</Text>
            <Text style={styles.activityMeta}>
              {nextActivity.meetingArea} · {signupCount(nextActivity)} 人已报名
            </Text>
          </View>
          <View style={[styles.joinBtn, nextStatus && styles.joinBtnDone]}>
            <Text style={[styles.joinText, nextStatus && styles.joinTextDone]}>{nextLabel}</Text>
          </View>
        </Card>
      ) : null}

      <SectionTitle title="最近记录" action="去开跑" onAction={() => router.push('/run')} />
      <Card>
        {recentRuns.slice(0, 3).map((run, index) => (
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

      <SectionTitle title="我的成长" action="查看全部" onAction={() => router.push('/growth')} />
      <View style={styles.growthRow}>
        <Card style={styles.growthCard}>
          <Text style={styles.growthValue}>{mock.pbs[1].result}</Text>
          <Text style={styles.growthLabel}>5K 个人最好</Text>
        </Card>
        <Card style={styles.growthCard}>
          <Text style={styles.growthValue}>{stats.monthKm.toFixed(1)}</Text>
          <Text style={styles.growthLabel}>本月跑量 km</Text>
        </Card>
        <Card style={styles.growthCard}>
          <Text style={styles.growthValue}>{mock.badges.length}</Text>
          <Text style={styles.growthLabel}>枚徽章</Text>
        </Card>
      </View>

      <SectionTitle title="经验库" action="去逛逛" onAction={() => router.push('/knowledge')} />
      <Card>
        <View style={styles.knowledgeTop}>
          <Pill text="教练精选" tone="gold" />
          <Text style={styles.knowledgeMeta}>
            {FEATURED_ARTICLE.minutes} 分钟 · {FEATURED_ARTICLE.level}
          </Text>
        </View>
        <Text style={styles.knowledgeTitle}>{FEATURED_ARTICLE.title}</Text>
        <Text style={styles.knowledgeBody}>{FEATURED_ARTICLE.summary}</Text>
        <Pressable
          onPress={() => router.push('/knowledge/' + FEATURED_ARTICLE.id)}
          style={styles.readMore}>
          <Text style={styles.readMoreText}>查看全文 ›</Text>
        </Pressable>
      </Card>

      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { fontSize: 17, fontWeight: '800', color: colors.white },
  brandName: { fontSize: 20, fontWeight: '800', color: colors.ink, letterSpacing: 0.5 },
  hello: { fontSize: 28, fontWeight: '800', color: colors.ink, letterSpacing: 0.2 },
  tagline: { fontSize: 14, color: colors.muted, marginTop: 4 },
  hero: {
    marginTop: 18,
    borderRadius: 26,
    backgroundColor: colors.brand,
    padding: 20,
    overflow: 'hidden',
  },
  heroGlowOne: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -70,
    right: -40,
  },
  heroGlowTwo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -50,
    left: -30,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.72)' },
  heroValueRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 },
  heroValue: { fontSize: 46, lineHeight: 52, fontWeight: '800', color: colors.white, letterSpacing: 0.5 },
  heroUnit: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
    marginLeft: 6,
    marginBottom: 8,
  },
  heroBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  heroHint: { fontSize: 11, color: 'rgba(255,255,255,0.72)' },
  heroHintStrong: { fontSize: 11, fontWeight: '800', color: colors.white },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  heroDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.14)' },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  quickPrimary: { flex: 1.15 },
  quickSecondary: { flex: 1 },
  clubTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clubBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubBadgeText: { fontSize: 18, fontWeight: '800', color: colors.brand },
  clubInfo: { flex: 1, gap: 3 },
  clubNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clubName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink },
  clubMeta: { fontSize: 11, color: colors.muted },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarStack: { borderWidth: 2, borderColor: colors.card, borderRadius: radius.pill },
  avatarStackOverlap: { marginLeft: -8 },
  avatarMore: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EDE4' },
  avatarMoreText: { fontSize: 9, fontWeight: '700', color: colors.muted },
  clubNote: { flexShrink: 1, marginLeft: 8, fontSize: 11, color: colors.muted },
  activityCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateBlock: {
    width: 58,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
  },
  dateDay: { fontSize: 11, fontWeight: '700', color: colors.brand },
  dateTime: { fontSize: 13, fontWeight: '800', color: colors.brand, marginTop: 2 },
  activityInfo: { flex: 1, gap: 3 },
  activityTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  activityMeta: { fontSize: 11, lineHeight: 16, color: colors.muted },
  joinBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  joinBtnDone: { backgroundColor: colors.brandSoft },
  joinText: { fontSize: 12, fontWeight: '700', color: colors.white },
  joinTextDone: { color: colors.brand },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  runRowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  runDate: { width: 66 },
  runDateText: { fontSize: 10, color: colors.muted },
  runInfo: { flex: 1, gap: 3 },
  runTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  runMeta: { fontSize: 10, color: colors.muted },
  growthRow: { flexDirection: 'row', gap: 8 },
  growthCard: { flex: 1, padding: 14 },
  growthValue: { fontSize: 18, fontWeight: '800', color: colors.brand },
  growthLabel: { fontSize: 10, color: colors.muted, marginTop: 4 },
  knowledgeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  knowledgeMeta: { fontSize: 10, color: colors.muted },
  knowledgeTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: 10, lineHeight: 22 },
  knowledgeBody: { fontSize: 12, lineHeight: 19, color: colors.muted, marginTop: 6 },
  readMore: { marginTop: 10 },
  readMoreText: { fontSize: 12, fontWeight: '700', color: colors.brand },
});
