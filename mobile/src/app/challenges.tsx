import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, DemoNote, Pill, PrimaryButton, ProgressBar, Screen } from '@/components/qingrun-ui';
import { colors, radius, space } from '@/constants/qingrun';
import { useChallenges } from '@/features/challenges/ChallengeContext';
import {
  CHALLENGE_STATUS_META,
  challengeProgressText,
  formatChallengeRange,
} from '@/features/challenges/challengeData';

export default function ChallengesScreen() {
  const router = useRouter();
  const { challenges, loading, error, refresh } = useChallenges();
  const active = challenges.filter((item) => item.status === 'active').length;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>
        {active > 0 ? <Pill text={active + ' 个进行中'} tone="green" /> : <Pill text="暂无进行中" tone="neutral" />}
      </View>

      <Text style={styles.title}>跑团挑战</Text>
      <Text style={styles.subtitle}>给一段时间定一个累计里程的小目标，只看自己的进度，不做速度排名。</Text>

      {loading && challenges.length === 0 ? (
        <Card style={styles.stateCard}>
          <Text style={styles.stateTitle}>正在加载挑战…</Text>
          <Text style={styles.stateBody}>正在同步团长发布的挑战和你的累计里程。</Text>
        </Card>
      ) : error && challenges.length === 0 ? (
        <Card style={styles.stateCard}>
          <Text style={styles.stateTitle}>挑战没加载出来</Text>
          <Text style={styles.stateBody}>{error}</Text>
          <PrimaryButton label="重新加载" onPress={() => void refresh()} style={styles.stateButton} />
        </Card>
      ) : challenges.length === 0 ? (
        <Card style={styles.stateCard}>
          <Text style={styles.stateTitle}>还没有挑战</Text>
          <Text style={styles.stateBody}>团长发布累计里程挑战后，会在这里看到目标和自己的进度。</Text>
        </Card>
      ) : (
        <View>
          {challenges.map((item) => {
            const meta = CHALLENGE_STATUS_META[item.status];
            return (
              <Card key={item.id} style={[styles.card, item.status === 'ended' && styles.endedCard]}>
                <View style={styles.cardTop}>
                  <Pill text={meta.label} tone={meta.tone} />
                  <Text style={styles.range}>{formatChallengeRange(item.startDate, item.endDate)}</Text>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody}>{item.description}</Text>

                <View style={styles.progressHead}>
                  <Text style={styles.progressValue}>{item.myKm.toFixed(1)} / {item.targetKm} km</Text>
                  <Text style={[styles.progressPercent, item.myCompleted && styles.progressDone]}>
                    {item.myCompleted ? '已完成' : item.myPercent + '%'}
                  </Text>
                </View>
                <ProgressBar value={item.myPercent} />

                <View style={styles.cardFoot}>
                  <Text style={styles.footText}>{challengeProgressText(item)}</Text>
                  <Text style={styles.footMeta}>
                    {item.status === 'upcoming'
                      ? '开始后自动累计社团可见记录'
                      : item.participantCount + ' 人参与 · ' + item.completedCount + ' 人完成'}
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <Text style={styles.footnote}>
        挑战只累计社团可见的跑步记录；活动出勤不重复计入，私密记录不计入。结束后进度只读，补录的记录不再计入。
      </Text>
      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  back: { fontSize: 14, fontWeight: '700', color: colors.brand },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.6 },
  subtitle: { marginTop: 6, fontSize: 14, lineHeight: 21, color: colors.muted },
  stateCard: { marginTop: space.lg, padding: space.lg, alignItems: 'flex-start' },
  stateTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  stateBody: { marginTop: 6, fontSize: 13, lineHeight: 20, color: colors.muted },
  stateButton: { marginTop: 14 },
  card: { marginTop: space.md, padding: space.lg },
  endedCard: { opacity: 0.86 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  range: { fontSize: 10, color: colors.muted },
  cardTitle: { marginTop: 10, fontSize: 18, fontWeight: '800', color: colors.ink, letterSpacing: -0.2 },
  cardBody: { marginTop: 5, fontSize: 12, lineHeight: 19, color: colors.muted },
  progressHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 14, marginBottom: 7 },
  progressValue: { fontSize: 14, fontWeight: '800', color: colors.brand },
  progressPercent: { fontSize: 11, fontWeight: '700', color: colors.muted },
  progressDone: { color: colors.brand },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11, gap: 10 },
  footText: { fontSize: 11, fontWeight: '700', color: colors.inkSoft },
  footMeta: { flexShrink: 1, textAlign: 'right', fontSize: 10, color: colors.muted },
  footnote: { marginTop: space.lg, fontSize: 10, lineHeight: 16, color: colors.muted },
});
