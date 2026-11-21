import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, DemoNote, Pill, PrimaryButton, Screen } from '@/components/qingrun-ui';
import { colors, radius, space } from '@/constants/qingrun';
import { useAnnouncements } from '@/features/announcements/AnnouncementContext';
import {
  ANNOUNCEMENT_META,
  announcementExcerpt,
  formatAnnouncementDate,
} from '@/features/announcements/announcementData';

type Filter = 'all' | 'unread';

export default function AnnouncementsScreen() {
  const router = useRouter();
  const { announcements, unread, loading, error, refresh } = useAnnouncements();
  const [filter, setFilter] = useState<Filter>('all');
  const rows = filter === 'unread' ? announcements.filter((item) => !item.read) : announcements;

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
        {unread > 0 ? <Pill text={unread + ' 条未读'} tone="coral" /> : <Pill text="已全部读完" tone="green" />}
      </View>

      <Text style={styles.title}>跑团公告</Text>
      <Text style={styles.subtitle}>集合提醒、训练调整和安全约定，团长发布后会保留在这里。</Text>

      <View style={styles.filterRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setFilter('all')}
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}>
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>全部 {announcements.length}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setFilter('unread')}
          style={[styles.filterChip, filter === 'unread' && styles.filterChipActive]}>
          <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>未读 {unread}</Text>
        </Pressable>
      </View>

      {loading && announcements.length === 0 ? (
        <Card style={styles.stateCard}>
          <Text style={styles.stateTitle}>正在加载公告…</Text>
          <Text style={styles.stateBody}>正在同步团长最近发布的安排。</Text>
        </Card>
      ) : error && announcements.length === 0 ? (
        <Card style={styles.stateCard}>
          <Text style={styles.stateTitle}>公告没加载出来</Text>
          <Text style={styles.stateBody}>{error}</Text>
          <PrimaryButton label="重新加载" onPress={() => void refresh()} style={styles.stateButton} />
        </Card>
      ) : rows.length === 0 ? (
        <Card style={styles.stateCard}>
          <Text style={styles.stateTitle}>{filter === 'unread' ? '没有未读公告' : '还没有公告'}</Text>
          <Text style={styles.stateBody}>
            {filter === 'unread'
              ? '团长发布新的集合提醒或训练调整后，会在这里出现。'
              : '团长发布集合提醒、训练调整后，会在这里留下记录。'}
          </Text>
          {filter === 'unread' ? (
            <PrimaryButton label="看全部公告" variant="light" onPress={() => setFilter('all')} style={styles.stateButton} />
          ) : null}
        </Card>
      ) : (
        <View>
          {rows.map((item) => {
            const meta = ANNOUNCEMENT_META[item.category];
            return (
              <Card
                key={item.id}
                onPress={() => router.push('/announcements/' + item.id)}
                style={[styles.card, !item.read && styles.unreadCard]}>
                <View style={styles.cardTop}>
                  <View style={styles.badges}>
                    {item.pinned ? <Pill text="置顶" tone="gold" /> : null}
                    <Pill text={meta.label} tone={meta.tone} />
                  </View>
                  {!item.read ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody}>{announcementExcerpt(item.content, 66)}</Text>
                <Text style={styles.cardMeta}>{item.author} · {formatAnnouncementDate(item.publishedAt)}</Text>
              </Card>
            );
          })}
        </View>
      )}

      <Text style={styles.footnote}>公告和站内消息都来自本地 Mock 数据，不接真实推送；刷新后仍会保留在当前演示数据里。</Text>
      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  back: { fontSize: 14, fontWeight: '700', color: colors.brand },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.6 },
  subtitle: { marginTop: 6, fontSize: 14, lineHeight: 21, color: colors.muted },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.lg, marginBottom: space.md },
  filterChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  filterChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  filterTextActive: { color: colors.white },
  stateCard: { padding: space.lg, alignItems: 'flex-start' },
  stateTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  stateBody: { marginTop: 6, fontSize: 13, lineHeight: 20, color: colors.muted },
  stateButton: { marginTop: space.md, alignSelf: 'stretch' },
  card: { padding: space.lg, marginBottom: space.sm, borderWidth: 1, borderColor: colors.line },
  unreadCard: { borderColor: colors.brand },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  cardTitle: { marginTop: 10, fontSize: 16, fontWeight: '800', lineHeight: 23, color: colors.ink },
  cardBody: { marginTop: 6, fontSize: 13, lineHeight: 20, color: colors.muted },
  cardMeta: { marginTop: 10, fontSize: 11, color: colors.muted },
  footnote: { marginTop: space.lg, fontSize: 12, lineHeight: 18, color: colors.muted },
});
