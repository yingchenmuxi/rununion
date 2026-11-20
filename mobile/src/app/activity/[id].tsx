import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { formatActivityDate, SIGNUP_LABELS } from '@/features/activities/activityData';

export default function ActivityDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const targetId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { activities, loading, error, refresh, signup, cancelSignup } = useActivities();
  const activity = activities.find((item) => item.id === targetId);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const back = (
    <Pressable onPress={() => router.back()} hitSlop={10}>
      <Text style={styles.back}>‹ 返回</Text>
    </Pressable>
  );

  if (!activity) {
    return (
      <Screen>
        {back}
        {loading ? (
          <Card style={styles.missingCard}>
            <Text style={styles.missingTitle}>正在加载活动…</Text>
            <Text style={styles.missingBody}>正在同步社团的报名与出勤记录。</Text>
          </Card>
        ) : error ? (
          <Card style={styles.missingCard}>
            <Text style={styles.missingTitle}>活动没加载出来</Text>
            <Text style={styles.missingBody}>{error}</Text>
            <PrimaryButton label="重新加载" onPress={() => void refresh()} style={styles.missingButton} />
          </Card>
        ) : (
          <Card style={styles.missingCard}>
            <Text style={styles.missingTitle}>没有找到这场活动</Text>
            <Text style={styles.missingBody}>它可能还没有发布，或者链接不完整。</Text>
            <PrimaryButton label="去看全部活动" onPress={() => router.replace('/activities')} style={styles.missingButton} />
          </Card>
        )}
      </Screen>
    );
  }

  const status = activity.mySignup?.status;
  const isEnded = activity.status === 'ended';
  const isSignedUp = status === 'pending' || status === 'approved';
  const attended = status === 'attended';
  const absent = status === 'absent';
  const awaitingCheckin = isEnded && status === 'approved';
  const taken = activity.signupCount;
  const full = taken >= activity.capacity;
  const meetingVisible =
    status === 'approved' || status === 'attended' || status === 'absent';

  const buttonLabel = isEnded
    ? attended
      ? '已参加这场活动'
      : absent
        ? '团长记录为未到'
        : awaitingCheckin
          ? '等待团长核对出勤'
          : '活动已结束'
    : isSignedUp
      ? status === 'pending'
        ? '取消报名（待确认）'
        : '取消报名'
      : status === 'declined'
        ? '重新报名'
        : full
          ? '名额已满'
          : '报名参加';

  const signupTitle =
    isEnded && status === 'approved'
      ? '待团长核对出勤'
      : status
        ? SIGNUP_LABELS[status]
        : '还没报名';

  const pillText =
    status === 'pending'
      ? '待确认'
      : status === 'approved'
        ? isEnded
          ? '待核对'
          : '已报名'
        : status === 'attended'
          ? '已参加'
          : status === 'absent'
            ? '未到'
            : status === 'declined'
              ? '已取消'
              : full
                ? '已满'
                : '开放';

  const pillTone =
    status === 'pending' || awaitingCheckin
      ? 'gold'
      : status === 'attended' || status === 'approved'
        ? 'green'
        : status === 'absent'
          ? 'coral'
          : 'neutral';

  const handleSignup = async () => {
    if (isEnded || busy) return;
    setBusy(true);
    if (isSignedUp) {
      const ok = await cancelSignup(activity.id);
      setFeedback(ok ? '已取消报名，名额已经释放。' : '取消失败，请稍后再试。');
      setBusy(false);
      return;
    }
    const result = await signup(activity.id);
    if (result === 'joined') setFeedback('报名已提交，等团长联系监护人确认。');
    if (result === 'already') setFeedback('你已经报过这场活动了。');
    if (result === 'full') setFeedback('名额刚好满了，可以看看其他场次。');
    if (result === 'closed') setFeedback('这场活动已经结束。');
    if (result === 'error') setFeedback('报名没提交成功，请确认演示数据服务已启动。');
    setBusy(false);
  };

  const signupNote = isSignedUp
    ? status === 'pending'
      ? '团长会在活动前联系你和监护人，确认后集合点会一直可见。'
      : '已确认。出发前如身体不适，取消报名即可，不必解释。'
    : isEnded
      ? attended
        ? '团长已记录你参加这场活动。出勤只用于社团记录，不公开排名。'
        : absent
          ? '团长记录为未到。未到不会取消报名记录，也不会释放名额；如果记录有误，请联系团长核对。'
          : awaitingCheckin
            ? '活动已结束，团长正在核对出勤。核对后会显示已参加或未到。'
            : '这场活动已经结束，没有你的参加记录。'
      : status === 'declined'
        ? '这次报名已经取消，名额已经释放。如果还想去，可以重新报名。'
        : full
          ? '名额已满，可以等有人取消，或先报名下一场。'
          : '提交后需团长与监护人确认，不会因为点了一下就直接放行。';

  return (
    <Screen>
      <View style={styles.topBar}>
        {back}
        <Text style={styles.demoTag}>共享演示活动</Text>
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
                  : status === 'declined'
                    ? '重新报名并确认后显示具体集合点'
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

      <SectionTitle title="报名与出勤" />
      <Card style={styles.signupCard}>
        <View style={styles.signupTop}>
          <View style={styles.signupTitleWrap}>
            <Text style={styles.signupTitle}>{signupTitle}</Text>
            <Text style={styles.signupSub}>
              {taken} / {activity.capacity} 人 · {isEnded ? '活动已结束' : '剩余 ' + Math.max(0, activity.capacity - taken) + ' 个名额'}
            </Text>
          </View>
          <Pill text={pillText} tone={pillTone} />
        </View>
        <ProgressBar value={Math.min(100, (taken / activity.capacity) * 100)} />
        <Text style={styles.signupNote}>{signupNote}</Text>
        {isEnded && (attended || absent) ? (
          <View style={styles.checkinRecord}>
            <Text style={styles.checkinRecordLabel}>团长已核对出勤</Text>
            <Text style={styles.checkinRecordText}>
              {attended ? '已参加' : '未到'}
              {activity.mySignup?.checkinAt ? ' · 记录已同步到社团后台' : ''}
            </Text>
          </View>
        ) : null}
        <PrimaryButton
          label={buttonLabel}
          variant={isSignedUp ? 'outline' : 'brand'}
          disabled={isEnded || busy || (full && !isSignedUp)}
          onPress={() => void handleSignup()}
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
  signupTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  signupTitleWrap: { flex: 1 },
  signupTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  signupSub: { fontSize: 10, color: colors.muted, marginTop: 4 },
  signupNote: { marginTop: 12, fontSize: 11, lineHeight: 18, color: colors.inkSoft },
  checkinRecord: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    gap: 3,
  },
  checkinRecordLabel: { fontSize: 9, fontWeight: '800', color: colors.brand, letterSpacing: 0.4 },
  checkinRecordText: { fontSize: 11, lineHeight: 16, color: colors.inkSoft },
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
  missingBody: { marginTop: 8, fontSize: 11, lineHeight: 17, color: colors.muted, textAlign: 'center' },
  missingButton: { marginTop: 18, alignSelf: 'stretch' },
});
