import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

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
import { formatActivityDate, SIGNUP_LABELS } from '@/features/activities/activityData';

export default function MyActivitiesScreen() {
  const router = useRouter();
  const {
    myUpcoming,
    myPast,
    pendingCount,
    confirmedCount,
    attendedCount,
    absentCount,
    checkinPendingCount,
    getSignupStatus,
    signupCount,
  } = useActivities();

  return (
    <Screen>
      <AppHeader
        title="我的活动"
        subtitle="报过的名、要去的场、已经跑完的路。"
        right={<Pill text={myUpcoming.length + ' 场待参加'} tone="green" />}
      />

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{myUpcoming.length}</Text>
          <Text style={styles.summaryLabel}>待参加</Text>
          <Text style={styles.summaryHint}>
            {pendingCount > 0 ? pendingCount + ' 场待确认' : confirmedCount > 0 ? '团长已确认' : '还没有报名'}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{attendedCount}</Text>
          <Text style={styles.summaryLabel}>已参加</Text>
          <Text style={styles.summaryHint}>
            {absentCount > 0 ? '另有 ' + absentCount + ' 场未到' : '线下活动记录'}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{checkinPendingCount}</Text>
          <Text style={styles.summaryLabel}>待核对</Text>
          <Text style={styles.summaryHint}>等团长核对出勤</Text>
        </View>
      </View>

      <SectionTitle title="待参加" action="找活动" onAction={() => router.push('/activities')} />
      <View style={styles.list}>
        {myUpcoming.map((activity) => {
          const status = getSignupStatus(activity.id);
          return (
            <Card
              key={activity.id}
              onPress={() => router.push('/activity/' + activity.id)}
              style={styles.activityCard}>
              <View style={styles.cardTop}>
                <View style={styles.dateBlock}>
                  <Text style={styles.dateText}>{activity.startTime}</Text>
                  <Text style={styles.dateSub}>{formatActivityDate(activity.dateISO)}</Text>
                </View>
                <Pill
                  text={status ? SIGNUP_LABELS[status] : '待参加'}
                  tone={status === 'pending' ? 'gold' : 'green'}
                />
              </View>
              <Text style={styles.title}>{activity.title}</Text>
              <Text style={styles.meta}>
                {activity.clubShort} · {activity.meetingArea} · {signupCount(activity)} 人已报名
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.footerHint}>
                  {status === 'pending' ? '团长会联系监护人确认，确认后集合点可见' : '集合点与准备事项已开放'}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Card>
          );
        })}
      </View>

      {myUpcoming.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>还没有待参加的活动</Text>
          <Text style={styles.emptyBody}>看看社团近期安排，报名后会在这里显示确认进度。</Text>
          <PrimaryButton label="去看看近期活动" onPress={() => router.push('/activities')} style={styles.emptyButton} />
        </Card>
      ) : null}

      <SectionTitle title="已结束" />
      <View style={styles.list}>
        {myPast.map((activity) => {
          const status = getSignupStatus(activity.id);
          const label = status === 'attended' ? '已参加' : status === 'absent' ? '未到' : '待核对';
          const tone = status === 'attended' ? 'green' : status === 'absent' ? 'coral' : 'gold';
          const hint =
            status === 'attended'
              ? '团长已核对出勤，去成长档案看看这周的记录'
              : status === 'absent'
                ? '团长记录为未到，不释放名额；有疑问请联系团长'
                : '活动已结束，等团长核对出勤';
          return (
            <Card
              key={activity.id}
              onPress={() => router.push('/activity/' + activity.id)}
              style={styles.activityCard}>
              <View style={styles.cardTop}>
                <Text style={styles.pastDate}>{formatActivityDate(activity.dateISO)}</Text>
                <Pill text={label} tone={tone} />
              </View>
              <Text style={styles.title}>{activity.title}</Text>
              <Text style={styles.meta}>
                {activity.clubShort} · {activity.distanceKm} km · {activity.coach}带跑
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.footerHint}>{hint}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Card>
          );
        })}
      </View>

      {myPast.length === 0 ? (
        <Text style={styles.noPast}>还没有参加记录。第一次来，跑走结合也算完成。</Text>
      ) : null}

      <SectionTitle title="报名与出勤" />
      <Card style={styles.noteCard}>
        <Text style={styles.noteTitle}>取消不需要理由</Text>
        <Text style={styles.noteBody}>
          临时有事、身体不舒服或天气不好，都可以在活动详情里取消。名额会回到活动里，不会影响之后的报名。
        </Text>
        <View style={styles.noteDivider} />
        <Text style={styles.noteTitle}>未到不等于被移出跑团</Text>
        <Text style={styles.noteBody}>
          赛后出勤只记录是否到场，不会取消报名、不释放名额，也不做公开排名。记录有误可以请团长撤销修正。
        </Text>
      </Card>

      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingVertical: space.xl,
    paddingHorizontal: space.md,
    marginBottom: space.md,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 30, fontWeight: '800', color: colors.white, lineHeight: 36 },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: colors.white, marginTop: 2 },
  summaryHint: { fontSize: 8.5, color: 'rgba(255,255,255,0.62)', marginTop: 5, textAlign: 'center' },
  summaryDivider: { width: 1, height: 48, backgroundColor: 'rgba(255,255,255,0.18)' },
  list: { gap: 10 },
  activityCard: { padding: space.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  dateBlock: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  dateText: { fontSize: 17, fontWeight: '800', color: colors.brand },
  dateSub: { fontSize: 10, color: colors.muted },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 10 },
  meta: { fontSize: 10, lineHeight: 16, color: colors.muted, marginTop: 4 },
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
  footerHint: { flex: 1, fontSize: 9, lineHeight: 14, color: colors.inkSoft },
  chevron: { fontSize: 20, color: colors.muted, marginTop: -2 },
  emptyCard: { alignItems: 'center', paddingVertical: 26 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  emptyBody: { marginTop: 7, fontSize: 11, lineHeight: 17, color: colors.muted, textAlign: 'center' },
  emptyButton: { marginTop: 16, alignSelf: 'stretch' },
  pastDate: { fontSize: 10, fontWeight: '700', color: colors.muted },
  noPast: { fontSize: 11, color: colors.muted, lineHeight: 18, textAlign: 'center', paddingVertical: 12 },
  noteCard: { padding: space.lg },
  noteTitle: { fontSize: 13, fontWeight: '800', color: colors.ink },
  noteBody: { marginTop: 5, fontSize: 11, lineHeight: 18, color: colors.muted },
  noteDivider: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
});
