import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, DemoNote, Pill, PrimaryButton, Screen } from '@/components/qingrun-ui';
import { colors, radius, space } from '@/constants/qingrun';
import { useNotifications } from '@/features/notifications/NotificationContext';
import {
  formatNotificationTime,
  NOTIFICATION_META,
  notificationTone,
  type MemberNotification,
} from '@/features/notifications/notificationData';

type Filter = 'all' | 'unread';

export default function NotificationsScreen() {
  const router = useRouter();
  const { items, unread, loading, error, refresh, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState<Filter>('all');
  const rows = filter === 'unread' ? items.filter((item) => !item.readAt) : items;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const open = async (item: MemberNotification) => {
    await markRead(item.id);
    if (item.announcementId) {
      router.push('/announcements/' + item.announcementId);
      return;
    }
    if (item.activityId) router.push('/activity/' + item.activityId);
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>
        {unread > 0 ? <Pill text={unread + ' 条未读'} tone="coral" /> : <Pill text="已全部读完" tone="green" />}
      </View>

      <Text style={styles.title}>消息</Text>
      <Text style={styles.subtitle}>报名结果、活动变更、赛后出勤和跑团公告，团长处理后会出现在这里。</Text>

      <View style={styles.filterRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setFilter('all')}
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}>
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>全部 {items.length}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setFilter('unread')}
          style={[styles.filterChip, filter === 'unread' && styles.filterChipActive]}>
          <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>未读 {unread}</Text>
        </Pressable>
        <View style={styles.filterSpacer} />
        <Pressable accessibilityRole="button" onPress={() => void markAllRead()} disabled={unread === 0} hitSlop={8}>
          <Text style={[styles.readAll, unread === 0 && styles.readAllDisabled]}>全部已读</Text>
        </Pressable>
      </View>

      {loading && items.length === 0 ? (
        <Card style={styles.stateCard}>
          <Text style={styles.stateTitle}>正在加载消息…</Text>
          <Text style={styles.stateBody}>正在同步跑团最近的处理结果。</Text>
        </Card>
      ) : error && items.length === 0 ? (
        <Card style={styles.stateCard}>
          <Text style={styles.stateTitle}>消息没加载出来</Text>
          <Text style={styles.stateBody}>{error}</Text>
          <PrimaryButton label="重新加载" onPress={() => void refresh()} style={styles.stateButton} />
        </Card>
      ) : rows.length === 0 ? (
        <Card style={styles.stateCard}>
          <Text style={styles.stateTitle}>{filter === 'unread' ? '没有未读消息' : '还没有消息'}</Text>
          <Text style={styles.stateBody}>
            {filter === 'unread'
              ? '团长处理报名、改期或核对出勤后，会在这里留下一条记录。'
              : '报名一场活动，团长确认后就能在这里看到结果。'}
          </Text>
          {filter === 'unread' ? (
            <PrimaryButton label="看全部消息" variant="light" onPress={() => setFilter('all')} style={styles.stateButton} />
          ) : (
            <PrimaryButton label="去看活动" variant="light" onPress={() => router.push('/activities')} style={styles.stateButton} />
          )}
        </Card>
      ) : (
        <View>
          {rows.map((item) => {
            const meta = NOTIFICATION_META[item.type];
            const tone = notificationTone(item);
            return (
              <Card key={item.id} onPress={() => void open(item)} style={[styles.messageCard, !item.readAt && styles.unreadCard]}>
                <View style={styles.messageTop}>
                  <View style={[styles.glyph, styles.glyphGreen, tone === 'gold' && styles.glyphGold, tone === 'coral' && styles.glyphCoral]}>
                    <Text style={[styles.glyphText, tone === 'gold' && styles.glyphTextGold, tone === 'coral' && styles.glyphTextCoral]}>
                      {meta.glyph}
                    </Text>
                  </View>
                  <View style={styles.messageHead}>
                    <View style={styles.messageTitleRow}>
                      <Text style={styles.messageTitle} numberOfLines={2}>{item.title}</Text>
                      {!item.readAt ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <Text style={styles.messageMeta}>{meta.label} · {formatNotificationTime(item.createdAt)}</Text>
                  </View>
                </View>
                <Text style={styles.messageBody}>{item.body}</Text>
                <Text style={styles.messageLink}>{item.announcementId ? '查看公告详情 ›' : '查看活动详情 ›'}</Text>
              </Card>
            );
          })}
        </View>
      )}

      <Text style={styles.footnote}>消息覆盖活动和公告事件，不做真实推送；刷新后仍会保留在当前演示数据里。</Text>
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
  filterSpacer: { flex: 1 },
  readAll: { fontSize: 13, fontWeight: '700', color: colors.brand },
  readAllDisabled: { color: colors.muted },
  stateCard: { padding: space.lg, alignItems: 'flex-start' },
  stateTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  stateBody: { marginTop: 6, fontSize: 13, lineHeight: 20, color: colors.muted },
  stateButton: { marginTop: space.md, alignSelf: 'stretch' },
  messageCard: { padding: space.lg, marginBottom: space.sm, borderWidth: 1, borderColor: colors.line },
  unreadCard: { borderColor: colors.brand },
  messageTop: { flexDirection: 'row', gap: 12 },
  glyph: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  glyphGreen: { backgroundColor: colors.brandSoft },
  glyphGold: { backgroundColor: colors.goldSoft },
  glyphCoral: { backgroundColor: colors.accentSoft },
  glyphText: { fontSize: 16, fontWeight: '800', color: colors.brand },
  glyphTextGold: { color: colors.gold },
  glyphTextCoral: { color: colors.accent },
  messageHead: { flex: 1, minWidth: 0 },
  messageTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  messageTitle: { flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 21, color: colors.ink },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 6 },
  messageMeta: { marginTop: 4, fontSize: 12, color: colors.muted },
  messageBody: { marginTop: 10, fontSize: 13, lineHeight: 20, color: colors.muted },
  messageLink: { marginTop: 10, fontSize: 13, fontWeight: '700', color: colors.brand },
  footnote: { marginTop: space.lg, fontSize: 12, lineHeight: 18, color: colors.muted },
});