import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, DemoNote, Pill, ProgressBar, Screen, SectionTitle } from '@/components/qingrun-ui';
import { colors, space } from '@/constants/qingrun';
import { CHARITY_ENTRIES, CHARITY_RULES, CHARITY_SUMMARY } from '@/features/charity/charityData';

export default function CharityScreen() {
  const router = useRouter();
  const percent = Math.round((CHARITY_SUMMARY.shoes / CHARITY_SUMMARY.goalShoes) * 100);

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>
        <Pill text="示例账本" tone="coral" />
      </View>

      <Text style={styles.title}>公益透明账本</Text>
      <Text style={styles.subtitle}>不让热爱被现实阻碍，也不让每一份帮助去向不明。</Text>

      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroKicker}>本期已落实</Text>
            <View style={styles.heroValueRow}>
              <Text style={styles.heroValue}>{CHARITY_SUMMARY.shoes}</Text>
              <Text style={styles.heroUnit}>双跑鞋</Text>
            </View>
          </View>
          <Pill text="不募集现金" tone="onDark" />
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}><Text style={styles.heroStatValue}>{CHARITY_SUMMARY.slots} 个</Text><Text style={styles.heroStatLabel}>参赛名额</Text></View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}><Text style={styles.heroStatValue}>{CHARITY_SUMMARY.coachHours} 小时</Text><Text style={styles.heroStatLabel}>教练时间</Text></View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}><Text style={styles.heroStatValue}>{CHARITY_SUMMARY.clubs} 个</Text><Text style={styles.heroStatLabel}>参与跑团</Text></View>
        </View>
      </Card>

      <SectionTitle title="本期进度" action="跑鞋目标" />
      <Card style={styles.progressCard}>
        <View style={styles.progressTop}>
          <Text style={styles.progressValue}>{CHARITY_SUMMARY.shoes} / {CHARITY_SUMMARY.goalShoes} 双</Text>
          <Text style={styles.progressPercent}>{percent}%</Text>
        </View>
        <ProgressBar value={percent} />
        <Text style={styles.progressNote}>目标按本学期训练名单估算，只统计已发放到人的物资。</Text>
      </Card>

      <SectionTitle title="物资去向" action="全部记录" />
      <Card style={styles.ledgerCard}>
        {CHARITY_ENTRIES.map((entry, index) => (
          <View key={entry.id} style={[styles.entry, index > 0 && styles.entryLine]}>
            <View style={styles.entryTop}>
              <Text style={styles.entryDate}>{entry.date}</Text>
              <Pill text={entry.status} tone={entry.status === '已落实' ? 'green' : entry.status === '进行中' ? 'gold' : 'neutral'} />
            </View>
            <Text style={styles.entryTitle}>{entry.title}</Text>
            <View style={styles.entryMetaRow}>
              <Text style={styles.entryMeta}>{entry.item} · {entry.quantity}</Text>
              <Text style={styles.entrySource}>{entry.source}</Text>
            </View>
            <Text style={styles.entryNote}>{entry.note}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle title="账本规则" />
      <Card style={styles.rulesCard}>
        {CHARITY_RULES.map((rule, index) => (
          <View key={rule} style={[styles.ruleRow, index > 0 && styles.ruleLine]}>
            <View style={styles.ruleIndex}><Text style={styles.ruleIndexText}>{index + 1}</Text></View>
            <Text style={styles.ruleText}>{rule}</Text>
          </View>
        ))}
      </Card>

      <Text style={styles.footnote}>这是可点击原型里的示例账本，不接真实捐赠、支付或受助人数据；正式版需要公益组织和学校共同审核。</Text>
      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  back: { fontSize: 14, fontWeight: '700', color: colors.brand },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.6 },
  subtitle: { marginTop: 6, fontSize: 14, lineHeight: 21, color: colors.muted },
  hero: { marginTop: space.lg, padding: space.lg, backgroundColor: colors.brand, borderColor: colors.brand },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroKicker: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  heroValueRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 },
  heroValue: { fontSize: 44, lineHeight: 50, fontWeight: '800', color: colors.white },
  heroUnit: { marginLeft: 6, marginBottom: 8, fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.72)' },
  heroStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)' },
  heroStat: { flex: 1 },
  heroStatValue: { fontSize: 15, fontWeight: '800', color: colors.white },
  heroStatLabel: { marginTop: 2, fontSize: 10, color: 'rgba(255,255,255,0.66)' },
  heroDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.14)' },
  progressCard: { padding: space.lg },
  progressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  progressValue: { fontSize: 16, fontWeight: '800', color: colors.ink },
  progressPercent: { fontSize: 13, fontWeight: '800', color: colors.brand },
  progressNote: { marginTop: 10, fontSize: 10, lineHeight: 16, color: colors.muted },
  ledgerCard: { paddingHorizontal: space.lg, paddingVertical: 4 },
  entry: { paddingVertical: 14 },
  entryLine: { borderTopWidth: 1, borderTopColor: colors.line },
  entryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryDate: { fontSize: 10, color: colors.muted },
  entryTitle: { marginTop: 6, fontSize: 15, fontWeight: '700', color: colors.ink },
  entryMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 5 },
  entryMeta: { fontSize: 12, fontWeight: '700', color: colors.brand },
  entrySource: { flexShrink: 1, fontSize: 10, color: colors.muted, textAlign: 'right' },
  entryNote: { marginTop: 6, fontSize: 11, lineHeight: 18, color: colors.muted },
  rulesCard: { paddingHorizontal: space.lg, paddingVertical: 2 },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12 },
  ruleLine: { borderTopWidth: 1, borderTopColor: colors.line },
  ruleIndex: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  ruleIndexText: { fontSize: 11, fontWeight: '800', color: colors.brand },
  ruleText: { flex: 1, fontSize: 11, lineHeight: 18, color: colors.inkSoft },
  footnote: { marginTop: space.lg, fontSize: 11, lineHeight: 17, color: colors.muted },
});

