import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, DemoNote, Pill, PrimaryButton, Screen } from '@/components/qingrun-ui';
import { colors, radius, space } from '@/constants/qingrun';
import { useAnnouncements } from '@/features/announcements/AnnouncementContext';
import {
  ANNOUNCEMENT_META,
  formatAnnouncementDate,
} from '@/features/announcements/announcementData';

export default function AnnouncementDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const targetId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { announcements, loading, error, refresh, markRead } = useAnnouncements();
  const item = announcements.find((row) => row.id === targetId);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (item && !item.read) void markRead(item.id);
  }, [item, markRead]);

  const back = (
    <Pressable onPress={() => router.back()} hitSlop={10}>
      <Text style={styles.back}>‹ 返回</Text>
    </Pressable>
  );

  if (!item) {
    return (
      <Screen>
        {back}
        {loading ? (
          <Card style={styles.stateCard}>
            <Text style={styles.stateTitle}>正在加载公告…</Text>
            <Text style={styles.stateBody}>正在同步团长最近发布的安排。</Text>
          </Card>
        ) : error ? (
          <Card style={styles.stateCard}>
            <Text style={styles.stateTitle}>公告没加载出来</Text>
            <Text style={styles.stateBody}>{error}</Text>
            <PrimaryButton label="重新加载" onPress={() => void refresh()} style={styles.stateButton} />
          </Card>
        ) : (
          <Card style={styles.stateCard}>
            <Text style={styles.stateTitle}>没有找到这条公告</Text>
            <Text style={styles.stateBody}>它可能已经被撤回，或者链接不完整。</Text>
            <PrimaryButton label="看全部公告" onPress={() => router.replace('/announcements')} style={styles.stateButton} />
          </Card>
        )}
      </Screen>
    );
  }

  const meta = ANNOUNCEMENT_META[item.category];
  const paragraphs = item.content.split(/\n{2,}/).filter(Boolean);

  return (
    <Screen>
      <View style={styles.topBar}>
        {back}
        {item.pinned ? <Pill text="置顶公告" tone="gold" /> : <Pill text={meta.label} tone={meta.tone} />}
      </View>

      <View style={styles.badgeRow}>
        <Pill text={meta.label} tone={meta.tone} />
        {item.pinned ? <Pill text="团长置顶" tone="gold" /> : null}
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>{item.author} · 发布于 {formatAnnouncementDate(item.publishedAt)}</Text>

      <Card style={styles.bodyCard}>
        {paragraphs.map((paragraph, index) => (
          <Text key={index} style={[styles.paragraph, index > 0 && styles.paragraphGap]}>
            {paragraph}
          </Text>
        ))}
      </Card>

      <Card style={styles.tipCard}>
        <Text style={styles.tipTitle}>看到了吗？</Text>
        <Text style={styles.tipBody}>
          公告只在展示时标记已读，不做真实推送。集合点等敏感信息仍然只在报名确认后对成员显示。
        </Text>
      </Card>

      <PrimaryButton
        label="看全部公告"
        variant="light"
        onPress={() => router.replace('/announcements')}
        style={styles.allButton}
      />
      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  back: { fontSize: 14, fontWeight: '700', color: colors.brand },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm },
  title: { marginTop: 10, fontSize: 28, fontWeight: '800', lineHeight: 37, color: colors.ink, letterSpacing: -0.4 },
  meta: { marginTop: 8, fontSize: 12, color: colors.muted },
  bodyCard: { marginTop: space.lg, padding: space.lg },
  paragraph: { fontSize: 14, lineHeight: 23, color: colors.inkSoft },
  paragraphGap: { marginTop: 14 },
  tipCard: { marginTop: space.md, padding: space.lg, backgroundColor: colors.brandSoft, borderColor: colors.brandSoft },
  tipTitle: { fontSize: 13, fontWeight: '800', color: colors.brand },
  tipBody: { marginTop: 5, fontSize: 12, lineHeight: 19, color: colors.brandDeep },
  allButton: { marginTop: space.lg },
  stateCard: { padding: space.lg, alignItems: 'flex-start', marginTop: space.lg },
  stateTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  stateBody: { marginTop: 6, fontSize: 13, lineHeight: 20, color: colors.muted },
  stateButton: { marginTop: space.md, alignSelf: 'stretch' },
});
