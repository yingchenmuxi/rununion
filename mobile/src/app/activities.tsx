import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppHeader,
  Card,
  DemoNote,
  Pill,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '@/components/qingrun-ui';
import { colors, radius, space } from '@/constants/qingrun';
import { useActivities } from '@/features/activities/ActivityContext';
import { formatActivityDay, formatActivityMonthDay } from '@/features/activities/activityData';

type FilterKey = 'all' | 'open' | 'mine' | 'past';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'open', label: '可报名' },
  { key: 'mine', label: '已报名' },
  { key: 'past', label: '已结束' },
];

export default function ActivitiesScreen() {
  const router = useRouter();
  const { activities, getSignupStatus, signupCount } = useActivities();
  const [filter, setFilter] = useState<FilterKey>('all');

  const rows = activities
    .filter((activity) => {
      const status = getSignupStatus(activity.id);
      if (filter === 'open') return activity.status === 'upcoming' && !status;
      if (filter === 'mine') return activity.status === 'upcoming' && (status === 'pending' || status === 'confirmed');
      if (filter === 'past') return activity.status === 'past';
      return true;
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'upcoming' ? -1 : 1;
      return a.dateISO.localeCompare(b.dateISO);
    });

  return (
    <Screen>
      <AppHeader title="活动" subtitle="跟跑团一起跑，别一个人硬撑。" />

      <View style={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = item.key === filter;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              testID={'activity-filter-' + item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.countRow}>
        <Text style={styles.countText}>共 {rows.length} 场 · 演示活动</Text>
        <Text style={styles.countHint}>点开看集合与报名状态</Text>
      </View>

      <View style={styles.list}>
        {rows.map((activity) => {
          const status = getSignupStatus(activity.id);
          const statusLabel =
            activity.status === 'past'
              ? status === 'attended'
                ? '已参加'
                : '已结束'
              : status === 'pending'
                ? '待确认'
                : status === 'confirmed'
                  ? '已报名'
                  : '可报名';
          return (
            <Card
              key={activity.id}
              onPress={() => router.push('/activity/' + activity.id)}
              style={styles.activityCard}>
              <View style={styles.cardTop}>
                <View style={styles.dateBlock}>
                  <Text style={styles.dateMonth}>{formatActivityMonthDay(activity.dateISO)}</Text>
                  <Text style={styles.dateDay}>{formatActivityDay(activity.dateISO)}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1}>
                      {activity.title}
                    </Text>
                    <Pill text={activity.tag} tone={activity.tag === '训练' ? 'gold' : 'green'} />
                  </View>
                  <Text style={styles.club}>{activity.clubShort} · {activity.startTime} 集合</Text>
                  <Text style={styles.meta}>
                    {activity.distanceKm} km · {activity.meetingArea} · {signupCount(activity)} 人已报名
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.pace}>{activity.paceHint}</Text>
                <View
                  style={[
                    styles.status,
                    statusLabel === '可报名' && styles.statusOpen,
                    statusLabel === '待确认' && styles.statusPending,
                    statusLabel === '已报名' && styles.statusMine,
                  ]}>
                  <Text
                    style={[
                      styles.statusText,
                      statusLabel === '可报名' && styles.statusTextOpen,
                      statusLabel === '待确认' && styles.statusTextPending,
                      statusLabel === '已报名' && styles.statusTextMine,
                    ]}>
                    {statusLabel}
                  </Text>
                </View>
              </View>
            </Card>
          );
        })}
      </View>

      {rows.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>这里还没有活动</Text>
          <Text style={styles.emptyBody}>换一个筛选，或回到全部活动看看近期安排。</Text>
          <PrimaryButton label="查看全部活动" variant="light" onPress={() => setFilter('all')} style={styles.emptyButton} />
        </Card>
      ) : null}

      <SectionTitle title="活动说明" />
      <Card style={styles.noteCard}>
        <Text style={styles.noteTitle}>报名不等于被放行</Text>
        <Text style={styles.noteBody}>
          未成年人提交报名后，团长会联系监护人确认。确认前不会显示具体集合点，也不会把联系方式交给其他参与者。
        </Text>
        <View style={styles.noteDivider} />
        <Text style={styles.noteTitle}>临时不去，提前说一声</Text>
        <Text style={styles.noteBody}>在活动详情里取消报名即可，名额会立刻回到活动里。</Text>
      </Card>

      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  filterTextActive: { color: colors.white },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  countText: { fontSize: 11, fontWeight: '700', color: colors.inkSoft },
  countHint: { fontSize: 9, color: colors.muted },
  list: { gap: 10 },
  activityCard: { padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dateBlock: {
    width: 54,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
  },
  dateMonth: { fontSize: 12, fontWeight: '800', color: colors.brand },
  dateDay: { fontSize: 10, fontWeight: '700', color: colors.brand, marginTop: 2 },
  cardInfo: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontSize: 15, fontWeight: '800', color: colors.ink },
  club: { fontSize: 10, color: colors.muted },
  meta: { fontSize: 10, lineHeight: 15, color: colors.inkSoft },
  chevron: { fontSize: 20, color: colors.muted, marginTop: -2 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 8,
  },
  pace: { flex: 1, fontSize: 10, lineHeight: 15, color: colors.muted },
  status: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: '#F1EDE4' },
  statusOpen: { backgroundColor: colors.accentSoft },
  statusPending: { backgroundColor: colors.goldSoft },
  statusMine: { backgroundColor: colors.brandSoft },
  statusText: { fontSize: 10, fontWeight: '800', color: colors.muted },
  statusTextOpen: { color: colors.accent },
  statusTextPending: { color: colors.gold },
  statusTextMine: { color: colors.brand },
  emptyCard: { alignItems: 'center', paddingVertical: 26 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  emptyBody: { marginTop: 7, fontSize: 11, lineHeight: 17, color: colors.muted, textAlign: 'center' },
  emptyButton: { marginTop: 16, alignSelf: 'stretch' },
  noteCard: { padding: space.lg },
  noteTitle: { fontSize: 13, fontWeight: '800', color: colors.ink },
  noteBody: { marginTop: 5, fontSize: 11, lineHeight: 18, color: colors.muted },
  noteDivider: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
});
