import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppHeader,
  Avatar,
  Card,
  DemoNote,
  Pill,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '@/components/qingrun-ui';
import { colors, mock, radius, space } from '@/constants/qingrun';
import { useActivities } from '@/features/activities/ActivityContext';
import { useAnnouncements } from '@/features/announcements/AnnouncementContext';
import { ANNOUNCEMENT_META, formatAnnouncementDate } from '@/features/announcements/announcementData';
import { useAuth } from '@/features/auth/AuthContext';

const CLUBS = [
  {
    name: '康福外国语学校长跑社',
    city: '北京',
    members: 128,
    weekly: '326 km',
    note: '校园操场 · 每周六 07:00',
    badge: '已认证',
    current: true,
  },
  {
    name: '朝阳公园少年跑团',
    city: '北京',
    members: 86,
    weekly: '214 km',
    note: '朝阳公园 · 每周日 06:30',
    badge: '同城',
    current: false,
  },
  {
    name: '奥森晨跑少年组',
    city: '北京',
    members: 54,
    weekly: '168 km',
    note: '奥森南园 · 每周三 19:30',
    badge: '同城',
    current: false,
  },
];

export default function SchoolScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { activities, upcomingActivities, getSignupStatus, signupCount } = useActivities();
  const { announcements, refresh: refreshAnnouncements } = useAnnouncements();
  const [applied, setApplied] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshAnnouncements();
    }, [refreshAnnouncements]),
  );

  return (
    <Screen>
      <AppHeader
        title="跑团"
        subtitle="找到身边一起跑的人，互通消息、共享资源。"
        right={<Avatar label={profile?.nickname.slice(0, 1) ?? mock.user.initial} size={38} />}
      />

      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.clubMark}>
            <Text style={styles.clubMarkText}>康</Text>
          </View>
          <View style={styles.heroInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.clubName} numberOfLines={1}>
                {mock.club.name}
              </Text>
              <Pill text="已认证" tone="green" />
            </View>
            <Text style={styles.clubMeta}>
              {mock.club.members} 名成员 · 本周 {mock.club.weekKm} km · {activities.length} 场活动
            </Text>
          </View>
        </View>
        <View style={styles.heroBottom}>
          <View style={styles.avatars}>
            {['林', '周', '陈'].map((name, index) => (
              <View key={name} style={[styles.avatarStack, index > 0 && styles.avatarOverlap]}>
                <Avatar label={name} size={30} tone={index} />
              </View>
            ))}
            <View style={[styles.avatarStack, styles.avatarOverlap, styles.avatarMore]}>
              <Text style={styles.avatarMoreText}>+125</Text>
            </View>
          </View>
          <PrimaryButton label="查看跑团" variant="light" onPress={() => router.push('/club')} style={styles.heroButton} />
        </View>
      </Card>

      <SectionTitle title="跑团公告" action="全部公告" onAction={() => router.push('/announcements')} />
      {announcements.slice(0, 2).map((item) => {
        const meta = ANNOUNCEMENT_META[item.category];
        return (
          <Card
            key={item.id}
            onPress={() => router.push('/announcements/' + item.id)}
            style={styles.announcementCard}>
            <View style={styles.announcementTop}>
              <View style={styles.announcementBadges}>
                {item.pinned ? <Pill text="置顶" tone="gold" /> : null}
                <Pill text={meta.label} tone={meta.tone} />
              </View>
              {!item.read ? <View style={styles.announcementDot} /> : null}
            </View>
            <Text style={styles.announcementTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.announcementMeta}>{item.author} · {formatAnnouncementDate(item.publishedAt)}</Text>
          </Card>
        );
      })}

      <SectionTitle title="同城跑团" action="北京" />
      <View style={styles.clubList}>
        {CLUBS.slice(1).map((club) => (
          <Card key={club.name} style={styles.clubCard}>
            <View style={styles.clubCardTop}>
              <View style={styles.clubInitial}>
                <Text style={styles.clubInitialText}>{club.name.slice(0, 1)}</Text>
              </View>
              <View style={styles.clubCardInfo}>
                <Text style={styles.clubCardName} numberOfLines={1}>
                  {club.name}
                </Text>
                <Text style={styles.clubCardMeta}>
                  {club.city} · {club.members} 名成员 · 本周 {club.weekly}
                </Text>
              </View>
              <Pill text={club.badge} tone="gold" />
            </View>
            <Text style={styles.clubCardNote}>{club.note}</Text>
            <View style={styles.clubCardFooter}>
              <Text style={styles.clubCardHint}>开放观摩 · 可先参加一次</Text>
              <Pressable style={styles.textButton}>
                <Text style={styles.textButtonText}>申请加入</Text>
              </Pressable>
            </View>
          </Card>
        ))}
      </View>

      <SectionTitle title="近期活动" action="全部活动" onAction={() => router.push('/activities')} />
      <View style={styles.activityList}>
        {upcomingActivities.map((activity) => {
          const status = getSignupStatus(activity.id);
          const active = status === 'pending' || status === 'approved';
          const label = status === 'pending' ? '待确认' : status === 'approved' ? '已报名' : '报名';
          return (
            <Card
              key={activity.id}
              onPress={() => router.push('/activity/' + activity.id)}
              style={styles.activityCard}>
              <View style={styles.dateBlock}>
                <Text style={styles.dateDay}>{activity.dateISO.slice(5, 7)}/{activity.dateISO.slice(8, 10)}</Text>
                <Text style={styles.dateTime}>{activity.startTime}</Text>
              </View>
              <View style={styles.activityInfo}>
                <View style={styles.activityTitleRow}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Pill text={activity.tag} tone="neutral" />
                </View>
                <Text style={styles.activityMeta}>
                  {activity.meetingArea} · {signupCount(activity)} 人已报名
                </Text>
              </View>
              <View style={[styles.joinBtn, active && styles.joinBtnDone]}>
                <Text style={[styles.joinText, active && styles.joinTextDone]}>{label}</Text>
              </View>
            </Card>
          );
        })}
      </View>

      <SectionTitle title="全国跑团入驻" />
      <Card style={styles.entryCard}>
        <View style={styles.entryTop}>
          <Pill text="公益备案" tone="green" />
          <Text style={styles.entryMeta}>面向全国</Text>
        </View>
        <Text style={styles.entryTitle}>把你的跑团，接进一张共同的地图</Text>
        <Text style={styles.entryBody}>
          各地青少年跑团自愿登记，互通活动消息、共享教练与场地资源。不收入驻费，不要求成绩门槛。
        </Text>
        <View style={styles.steps}>
          <View style={styles.step}>
            <View style={styles.stepIndex}>
              <Text style={styles.stepIndexText}>1</Text>
            </View>
            <Text style={styles.stepText}>填写跑团与负责人信息</Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepIndex}>
              <Text style={styles.stepIndexText}>2</Text>
            </View>
            <Text style={styles.stepText}>学校或属地体育部门审核</Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepIndex}>
              <Text style={styles.stepIndexText}>3</Text>
            </View>
            <Text style={styles.stepText}>开通跑团主页与活动发布</Text>
          </View>
        </View>
        <PrimaryButton
          label={applied ? '申请已提交（演示）' : '申请入驻'}
          variant={applied ? 'light' : 'brand'}
          onPress={() => setApplied(true)}
          style={styles.entryButton}
        />
        {applied ? <Text style={styles.appliedNote}>演示状态：正式版会进入人工审核，并联系学校确认。</Text> : null}
      </Card>

      <Card style={styles.safetyCard}>
        <Text style={styles.safetyTitle}>一起跑，也要安全地跑</Text>
        <Text style={styles.safetyBody}>
          未成年人参加线下活动需监护人知情同意；活动页默认不公开精确集合位置，仅报名成功后可见。
        </Text>
      </Card>

      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { padding: space.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clubMark: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubMarkText: { fontSize: 20, fontWeight: '800', color: colors.brand },
  heroInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clubName: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.ink },
  clubMeta: { fontSize: 11, lineHeight: 16, color: colors.muted },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarStack: { borderWidth: 2, borderColor: colors.card, borderRadius: radius.pill },
  avatarOverlap: { marginLeft: -8 },
  avatarMore: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EDE4' },
  avatarMoreText: { fontSize: 9, fontWeight: '700', color: colors.muted },
  heroButton: { minHeight: 38, paddingHorizontal: 14 },
  announcementCard: { padding: space.lg, marginBottom: space.sm, borderWidth: 1, borderColor: colors.line },
  announcementTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  announcementBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  announcementDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  announcementTitle: { marginTop: 8, fontSize: 15, fontWeight: '800', lineHeight: 22, color: colors.ink },
  announcementMeta: { marginTop: 6, fontSize: 11, color: colors.muted },
  clubList: { gap: 10 },
  clubCard: { padding: space.lg },
  clubCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clubInitial: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubInitialText: { fontSize: 16, fontWeight: '800', color: colors.gold },
  clubCardInfo: { flex: 1, gap: 3 },
  clubCardName: { fontSize: 14, fontWeight: '800', color: colors.ink },
  clubCardMeta: { fontSize: 11, color: colors.muted },
  clubCardNote: { marginTop: 10, fontSize: 12, color: colors.inkSoft },
  clubCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  clubCardHint: { fontSize: 10, color: colors.muted },
  textButton: { paddingVertical: 4, paddingLeft: 8 },
  textButtonText: { fontSize: 12, fontWeight: '800', color: colors.brand },
  activityList: { gap: 10 },
  activityCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  dateBlock: {
    width: 52,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
  },
  dateDay: { fontSize: 10, fontWeight: '700', color: colors.brand },
  dateTime: { fontSize: 12, fontWeight: '800', color: colors.brand, marginTop: 2 },
  activityInfo: { flex: 1, gap: 4 },
  activityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityTitle: { flexShrink: 1, fontSize: 14, fontWeight: '800', color: colors.ink },
  activityMeta: { fontSize: 10, lineHeight: 15, color: colors.muted },
  joinBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.brand },
  joinBtnDone: { backgroundColor: colors.brandSoft },
  joinText: { fontSize: 11, fontWeight: '800', color: colors.white },
  joinTextDone: { color: colors.brand },
  entryCard: { padding: space.lg },
  entryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryMeta: { fontSize: 10, color: colors.muted },
  entryTitle: { marginTop: 10, fontSize: 18, fontWeight: '800', lineHeight: 25, color: colors.ink },
  entryBody: { marginTop: 8, fontSize: 12, lineHeight: 19, color: colors.muted },
  steps: { marginTop: 14, gap: 9 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stepIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndexText: { fontSize: 10, fontWeight: '800', color: colors.brand },
  stepText: { flex: 1, fontSize: 12, color: colors.inkSoft },
  entryButton: { marginTop: 16 },
  appliedNote: { marginTop: 8, fontSize: 11, lineHeight: 17, color: colors.accent },
  safetyCard: { marginTop: 16, padding: space.lg, backgroundColor: colors.brandSoft, borderColor: colors.brandSoft },
  safetyTitle: { fontSize: 13, fontWeight: '800', color: colors.brand },
  safetyBody: { marginTop: 5, fontSize: 11, lineHeight: 18, color: colors.brandDeep },
});
