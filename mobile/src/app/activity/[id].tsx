import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  DemoNote,
  Pill,
  PrimaryButton,
  ProgressBar,
  Screen,
  SectionTitle,
} from '@/components/qingrun-ui';
import { colors, radius, space } from '@/constants/qingrun';
import { useActivities } from '@/features/activities/ActivityContext';
import {
  formatActivityDate,
  getActivity,
  SIGNUP_LABELS,
} from '@/features/activities/activityData';

export default function ActivityDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const activity = getActivity(params.id);
  const { getSignupStatus, signup, cancelSignup, signupCount } = useActivities();
  const [feedback, setFeedback] = useState('');

  if (!activity) {
    return (
      <Screen>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>
        <Card style={styles.missingCard}>
          <Text style={styles.missingTitle}>没有找到这场活动</Text>
          <Text style={styles.missingBody}>它可能已经结束，或者链接不完整。</Text>
          <PrimaryButton label="去看全部活动" onPress={() => router.replace('/activities')} style={styles.missingButton} />
        </Card>
      </Screen>
    );
  }

  const status = getSignupStatus(activity.id);
  const isPast = activity.status === 'past';
  const isSignedUp = status === 'pending' || status === 'confirmed';
  const attended = status === 'attended';
  const taken = signupCount(activity);
  const full = taken >= activity.capacity;
  const meetingVisible = status === 'confirmed' || attended;

  const buttonLabel = isPast
    ? attended
      ? '已参加这场活动'
      : '活动已结束'
    : isSignedUp
      ? status === 'pending'
        ? '取消报名（待确认）'
        : '取消报名'
      : full
        ? '名额已满'
        : '报名参加';

  const handleSignup = () => {
    if (isPast) return;
    if (isSignedUp) {
      if (cancelSignup(activity.id)) setFeedback('已取消报名，名额已经释放。');
      return;
    }
    const result = signup(activity.id);
    if (result === 'joined') setFeedback('报名已提交，等团长联系监护人确认。');
    if (result === 'already') setFeedback('你已经报过这场活动了。');
    if (result === 'full') setFeedback('名额刚好满了，可以看看其他场次。');
    if (result === 'closed') setFeedback('这场活动已经结束。');
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>
        <Text style={styles.demoTag}>演示活动</Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Pill text={activity.tag} tone="onDark" />
          <Text style={styles.heroDate}>{formatActivityDate(activity.dateISO)}</Text>
        </View>
        <Text style={styles.heroTitle}>{activity.title}</Text>
        <Text style={styles.heroClub}>{activity.club}</Text>
        <View style={styles.heroMeta}>
          <View style={styles.heroMetaItem}>
            <Text style={styles.heroMetaValue}>{activity.startTime}</Text>
            <Text style={styles.heroMetaLabel}>集合</Text>
          </View>
          <View style={styles.heroMetaDivider} />
          <View style={styles.heroMetaItem}>
            <Text style={styles.heroMetaValue}>{activity.distanceKm} km</Text>
            <Text style={styles.heroMetaLabel}>距离</Text>
          </View>
          <View style={styles.heroMetaDivider} />
          <View style={styles.heroMetaItem}>
            <Text style={styles.heroMetaValue}>{activity.durationMin} 分钟</Text>
            <Text style={styles.heroMetaLabel}>预计</Text>
          </View>
        </View>
      </View>

      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>集合地点</Text>
          <View style={styles.infoValueWrap}>
            <Text style={styles.infoValue}>{activity.meetingArea}</Text>
            <Text style={styles.infoSub}>
              {meetingVisible
                ? activity.meetingDetail
                : status === 'pending'
                  ? '团长确认后显示具体集合点'
                  : '报名确认后显示具体集合点'}
            </Text>
          </View>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>带跑教练</Text>
          <View style={styles.infoValueWrap}>
            <Text style={styles.infoValue}>{activity.coach}</Text>
            <Text style={styles.infoSub}>全程有领跑和收队，不要求跑完全程</Text>
          </View>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>强度</Text>
          <View style={styles.infoValueWrap}>
            <Text style={styles.infoValue}>{activity.paceHint}</Text>
            <Text style={styles.infoSub}>按自己的节奏，身体不适立即停下</Text>
          </View>
        </View>
      </Card>

      <SectionTitle title="活动安排" />
      <Text style={styles.paragraph}>{activity.description}</Text>

      <SectionTitle title="出发前准备" />
      <Card style={styles.checkCard}>
        {activity.checklist.map((item) => (
          <View key={item} style={styles.checkRow}>
            <View style={styles.checkDot}>
              <Text style={styles.checkMark}>✓</Text>
            </View>
            <Text style={styles.checkText}>{item}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeLabel}>注意</Text>
        <Text style={styles.noticeText}>{activity.notice}</Text>
      </View>

      <SectionTitle title="报名状态" />
      <Card style={styles.signupCard}>
        <View style={styles.signupTop}>
          <View>
            <Text style={styles.signupTitle}>{status ? SIGNUP_LABELS[status] : '还没报名'}</Text>
            <Text style={styles.signupSub}>
              {taken} / {activity.capacity} 人 · {isPast ? '活动已结束' : '剩余 ' + Math.max(0, activity.capacity - taken) + ' 个名额'}
            </Text>
          </View>
          <Pill
            text={status === 'pending' ? '待确认' : status === 'confirmed' ? '已报名' : status === 'attended' ? '已参加' : full ? '已满' : '开放'}
            tone={status === 'pending' ? 'gold' : status ? 'green' : 'neutral'}
          />
        </View>
        <ProgressBar value={(taken / activity.capacity) * 100} />
        <Text style={styles.signupNote}>
          {isSignedUp
            ? status === 'pending'
              ? '团长会在活动前联系你和监护人，确认后集合点会一直可见。'
              : '已确认。出发前如身体不适，取消报名即可，不必解释。'
            : isPast
              ? attended
                ? '这场活动已经结束。完成情况已记录，去成长档案看看。'
                : '这场活动已经结束，没有参加记录。'
              : full
                ? '名额已满，可以等有人取消，或先报名下一场。'
                : '提交后需团长与监护人确认，不会因为点了一下就直接放行。'}
        </Text>
        <PrimaryButton
          label={buttonLabel}
          variant={isSignedUp ? 'outline' : 'brand'}
          disabled={isPast || full}
          onPress={handleSignup}
          style={styles.signupButton}
        />
        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      </Card>

      <SectionTitle title="安全说明" />
      <Card style={styles.safetyCard}>
        <Text style={styles.safetyText}>
          活动由学校社团或同城跑团组织，平台只负责展示与报名记录。未成年人参加线下活动，需要监护人知情；遇到天气预警、身体不适或集合点变更，以团长通知为准。
        </Text>
        <Pressable onPress={() => router.push('/activities')} style={styles.safetyLink}>
          <Text style={styles.safetyLinkText}>看看其他活动 ›</Text>
        </Pressable>
      </Card>

      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  back: { fontSize: 12, fontWeight: '800', color: colors.brand },
  demoTag: { fontSize: 10, color: colors.muted },
  hero: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    padding: space.xl,
    marginBottom: space.lg,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroDate: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  heroTitle: { fontSize: 27, fontWeight: '800', color: colors.white, marginTop: 12, lineHeight: 35 },
  heroClub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', marginTop: space.xl },
  heroMetaItem: { flex: 1 },
  heroMetaValue: { fontSize: 15, fontWeight: '800', color: colors.white },
  heroMetaLabel: { fontSize: 10, color: 'rgba(255,255,255,0.62)', marginTop: 3 },
  heroMetaDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 8 },
  infoCard: { paddingVertical: 4, paddingHorizontal: space.lg },
  infoRow: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  infoLabel: { width: 58, fontSize: 10, fontWeight: '700', color: colors.muted, paddingTop: 2 },
  infoValueWrap: { flex: 1, gap: 4 },
  infoValue: { fontSize: 13, fontWeight: '700', color: colors.ink, lineHeight: 19 },
  infoSub: { fontSize: 10, lineHeight: 16, color: colors.muted },
  infoDivider: { height: 1, backgroundColor: colors.line, marginLeft: 70 },
  paragraph: { fontSize: 13, lineHeight: 23, color: colors.inkSoft },
  checkCard: { paddingVertical: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  checkDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 10, fontWeight: '800', color: colors.brand },
  checkText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.inkSoft },
  noticeCard: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#F3D7CE',
  },
  noticeLabel: { fontSize: 10, fontWeight: '800', color: colors.accent, letterSpacing: 0.5 },
  noticeText: { marginTop: 6, fontSize: 11, lineHeight: 18, color: colors.inkSoft },
  signupCard: { padding: space.lg },
  signupTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  signupTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  signupSub: { fontSize: 10, color: colors.muted, marginTop: 4 },
  signupNote: { marginTop: 12, fontSize: 11, lineHeight: 18, color: colors.inkSoft },
  signupButton: { marginTop: 14 },
  feedback: {
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    fontSize: 10,
    lineHeight: 15,
    color: colors.brand,
  },
  safetyCard: { padding: space.lg },
  safetyText: { fontSize: 11, lineHeight: 19, color: colors.muted },
  safetyLink: { marginTop: 12, alignSelf: 'flex-start' },
  safetyLinkText: { fontSize: 11, fontWeight: '800', color: colors.brand },
  missingCard: { marginTop: 30, alignItems: 'center', paddingVertical: 30 },
  missingTitle: { fontSize: 19, fontWeight: '800', color: colors.ink },
  missingBody: { marginTop: 8, fontSize: 11, color: colors.muted },
  missingButton: { marginTop: 18, alignSelf: 'stretch' },
});
