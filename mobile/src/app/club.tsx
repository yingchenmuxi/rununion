import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, DemoNote, Pill, PrimaryButton, Screen, SectionTitle } from '@/components/qingrun-ui';
import { colors, radius, space } from '@/constants/qingrun';
import { useActivities } from '@/features/activities/ActivityContext';
import { formatActivityDate } from '@/features/activities/activityData';
import { useAnnouncements } from '@/features/announcements/AnnouncementContext';
import {
  ANNOUNCEMENT_META,
  formatAnnouncementDate,
} from '@/features/announcements/announcementData';

export default function ClubScreen() {
  const router = useRouter();
  const { announcements, loading: announcementsLoading, refresh: refreshAnnouncements } = useAnnouncements();
  const { activities, upcomingActivities, getSignupStatus, refresh: refreshActivities } = useActivities();

  useFocusEffect(
    useCallback(() => {
      void refreshAnnouncements();
      void refreshActivities();
    }, [refreshAnnouncements, refreshActivities]),
  );
  const latest = announcements.slice(0, 3);
  const upcoming = upcomingActivities.slice(0, 2);

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>
        <Pill text="共享演示活动" tone="neutral" />
      </View>

      <Text style={styles.title}>跑团主页</Text>
      <Text style={styles.subtitle}>康福外国语学校长跑社 · 校园操场每周六 07:00</Text>

      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.clubMark}>
            <Text style={styles.clubMarkText}>康</Text>
          </View>
          <View style={styles.heroInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.clubName} numberOfLines={1}>康福外国语学校长跑社</Text>
              <Pill text="已认证" tone="green" />
            </View>
            <Text style={styles.clubMeta}>128 名成员 · 本周 326 km · {activities.length} 场活动</Text>
          </View>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>128</Text>
            <Text style={styles.heroStatLabel}>在册成员</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>326</Text>
            <Text style={styles.heroStatLabel}>本周公里</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{announcements.length}</Text>
            <Text style={styles.heroStatLabel}>公告</Text>
          </View>
        </View>
      </Card>

      <SectionTitle title="跑团公告" action="全部公告" onAction={() => router.push('/announcements')} />
      {announcementsLoading && latest.length === 0 ? (
        <Card style={styles.stateCard}>
          <Text style={styles.stateBody}>正在加载公告…</Text>
        </Card>
      ) : latest.length === 0 ? (
        <Card style={styles.stateCard}>
          <Text style={styles.stateBody}>团长还没有发布公告。</Text>
        </Card>
      ) : (
        latest.map((item) => {
          const meta = ANNOUNCEMENT_META[item.category];
          return (
            <Card
              key={item.id}
              onPress={() => router.push('/announcements/' + item.id)}
              style={styles.announcementCard}>
              <View style={styles.announcementTop}>
                <View style={styles.badges}>
                  {item.pinned ? <Pill text="置顶" tone="gold" /> : null}
                  <Pill text={meta.label} tone={meta.tone} />
                </View>
                {!item.read ? <View style={styles.unreadDot} /> : null}
              </View>
              <Text style={styles.announcementTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.announcementMeta}>{item.author} · {formatAnnouncementDate(item.publishedAt)}</Text>
            </Card>
          );
        })
      )}

      <SectionTitle title="近期活动" action="全部活动" onAction={() => router.push('/activities')} />
      {upcoming.length === 0 ? (
        <Card style={styles.stateCard}>
          <Text style={styles.stateBody}>最近没有安排线下活动。</Text>
        </Card>
      ) : (
        upcoming.map((activity) => {
          const status = getSignupStatus(activity.id);
          const label = status === 'pending' ? '待确认' : status === 'approved' ? '已报名' : '报名';
          return (
            <Card
              key={activity.id}
              onPress={() => router.push('/activity/' + activity.id)}
              style={styles.activityCard}>
              <View style={styles.activityDate}>
                <Text style={styles.activityDay}>{formatActivityDate(activity.dateISO).replace(' 周', '')}</Text>
                <Text style={styles.activityTime}>{activity.startTime}</Text>
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activityMeta}>{activity.meetingArea} · {activity.distanceKm} km</Text>
              </View>
              <Pill text={label} tone={status === 'approved' ? 'green' : 'neutral'} />
            </Card>
          );
        })
      )}

      <SectionTitle title="跑团信息" />
      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>固定集合</Text>
          <Text style={styles.infoValue}>学校操场 · 每周六 07:00</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>带跑教练</Text>
          <Text style={styles.infoValue}>陈教练、周教练 · 全程有收队</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>适合年级</Text>
          <Text style={styles.infoValue}>初一至高三 · 不设成绩门槛</Text>
        </View>
        <View style={[styles.infoRow, styles.infoRowLast]}>
          <Text style={styles.infoLabel}>费用</Text>
          <Text style={styles.infoValue}>不收取训练费 · 装备自愿</Text>
        </View>
      </Card>

      <Card style={styles.safetyCard}>
        <Text style={styles.safetyTitle}>一起跑，也要安全地跑</Text>
        <Text style={styles.safetyBody}>
          未成年人参加线下活动需监护人知情同意；集合点只在报名确认后显示。公告和活动信息都以团长发布的最新版本为准。
        </Text>
      </Card>

      <PrimaryButton label="看全部公告" variant="light" onPress={() => router.push('/announcements')} style={styles.allButton} />
      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  back: { fontSize: 14, fontWeight: '700', color: colors.brand },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.6 },
  subtitle: { marginTop: 6, fontSize: 13, lineHeight: 20, color: colors.muted },
  hero: { marginTop: space.lg, padding: space.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clubMark: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  clubMarkText: { fontSize: 20, fontWeight: '800', color: colors.brand },
  heroInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clubName: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.ink },
  clubMeta: { fontSize: 11, lineHeight: 16, color: colors.muted },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  heroStat: { flex: 1, alignItems: 'center', gap: 3 },
  heroStatValue: { fontSize: 18, fontWeight: '800', color: colors.brand },
  heroStatLabel: { fontSize: 10, color: colors.muted },
  heroDivider: { width: 1, height: 24, backgroundColor: colors.line },
  stateCard: { padding: space.lg, marginBottom: space.sm },
  stateBody: { fontSize: 13, lineHeight: 20, color: colors.muted },
  announcementCard: { padding: space.lg, marginBottom: space.sm, borderWidth: 1, borderColor: colors.line },
  announcementTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  announcementTitle: { marginTop: 8, fontSize: 15, fontWeight: '800', lineHeight: 22, color: colors.ink },
  announcementMeta: { marginTop: 6, fontSize: 11, color: colors.muted },
  activityCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginBottom: space.sm },
  activityDate: { width: 54, paddingVertical: 8, borderRadius: 13, backgroundColor: colors.brandSoft, alignItems: 'center' },
  activityDay: { fontSize: 10, fontWeight: '700', color: colors.brand, textAlign: 'center' },
  activityTime: { fontSize: 12, fontWeight: '800', color: colors.brand, marginTop: 2 },
  activityInfo: { flex: 1, gap: 4 },
  activityTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  activityMeta: { fontSize: 10, lineHeight: 15, color: colors.muted },
  infoCard: { paddingHorizontal: space.lg },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { fontSize: 12, color: colors.muted },
  infoValue: { flexShrink: 1, marginLeft: 14, fontSize: 12, fontWeight: '700', color: colors.ink, textAlign: 'right' },
  safetyCard: { marginTop: space.lg, padding: space.lg, backgroundColor: colors.brandSoft, borderColor: colors.brandSoft },
  safetyTitle: { fontSize: 13, fontWeight: '800', color: colors.brand },
  safetyBody: { marginTop: 5, fontSize: 11, lineHeight: 18, color: colors.brandDeep },
  allButton: { marginTop: space.lg },
});
