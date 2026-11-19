import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import {
  AppHeader,
  Avatar,
  Card,
  DemoNote,
  Divider,
  ListRow,
  Pill,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '@/components/qingrun-ui';
import { colors, mock, radius, space } from '@/constants/qingrun';
import { useAuth } from '@/features/auth/AuthContext';
import { useRuns } from '@/features/runs/RunContext';

export default function ProfileScreen() {
  const { profile, logout } = useAuth();
  const { stats } = useRuns();
  const displayName = profile?.nickname ?? mock.user.name;
  const grade = profile?.grade ?? mock.user.grade;
  const initial = displayName.slice(0, 1);
  const [toast, setToast] = useState('');
  const [cityVisible, setCityVisible] = useState(false);
  const [recordVisible, setRecordVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = (message: string) => setToast(message);

  return (
    <Screen>
      <AppHeader title="我的" subtitle="一个普通跑者的成长档案。" />

      <Card style={styles.userCard}>
        <View style={styles.userTop}>
          <Avatar label={initial} size={56} />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userSchool}>
              {mock.user.school} · {grade}
            </Text>
            <Pill text={mock.user.level} tone="green" />
          </View>
          <Pressable onPress={() => notify('编辑资料：演示版暂未开放')} hitSlop={8}>
            <Text style={styles.editText}>编辑</Text>
          </Pressable>
        </View>
        <View style={styles.userStats}>
          <View style={styles.userStat}>
            <Text style={styles.userStatValue}>{stats.monthKm.toFixed(1)}</Text>
            <Text style={styles.userStatLabel}>本月 km</Text>
          </View>
          <View style={styles.userStatDivider} />
          <View style={styles.userStat}>
            <Text style={styles.userStatValue}>{mock.week.streak} 周</Text>
            <Text style={styles.userStatLabel}>连续记录</Text>
          </View>
          <View style={styles.userStatDivider} />
          <View style={styles.userStat}>
            <Text style={styles.userStatValue}>{mock.badges.length} 枚</Text>
            <Text style={styles.userStatLabel}>成长徽章</Text>
          </View>
        </View>
      </Card>

      {toast ? <Text style={styles.toast}>{toast}</Text> : null}

      <SectionTitle title="我的服务" />
      <Card style={styles.listCard}>
        <ListRow
          glyph="团"
          title="我的跑团"
          subtitle={mock.club.name}
          onPress={() => notify('我的跑团：演示版将跳转跑团主页')}
        />
        <Divider />
        <ListRow
          glyph="长"
          title="成长档案"
          subtitle="个人最好、跑量与徽章"
          onPress={() => notify('成长档案：演示版将跳转成长页')}
        />
        <Divider />
        <ListRow
          glyph="活"
          title="我的活动"
          subtitle="已报名 2 场 · 待参加 1 场"
          onPress={() => notify('我的活动：演示版将展示报名记录')}
        />
        <Divider />
        <ListRow
          glyph="书"
          title="经验库收藏"
          subtitle="收藏了 3 篇训练与康复笔记"
          onPress={() => notify('经验库收藏：演示版将展示收藏列表')}
        />
      </Card>

      <SectionTitle title="公益助跑" />
      <Card style={styles.charityCard}>
        <View style={styles.charityTop}>
          <Pill text="公益通道" tone="coral" />
          <Text style={styles.charityMeta}>物资 · 名额 · 教练时间</Text>
        </View>
        <Text style={styles.charityTitle}>不让热爱被现实阻碍</Text>
        <Text style={styles.charityBody}>
          为有长跑梦想、但家庭条件有限的青少年提供跑鞋、参赛名额与教练陪伴。第一版不直接募集现金，避免未成年人接触资金风险。
        </Text>
        <PrimaryButton
          label="了解帮扶通道"
          variant="light"
          onPress={() => notify('帮扶通道：正式版将说明申请条件与审核流程')}
          style={styles.charityButton}
        />
      </Card>

      <SectionTitle title="安全与隐私" action="安全中心" onAction={() => notify('安全中心：演示版暂未开放')} />
      <Card style={styles.privacyCard}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchTitle}>允许同城跑友找到我</Text>
            <Text style={styles.switchHint}>只显示城市与年龄段</Text>
          </View>
          <Switch
            value={cityVisible}
            onValueChange={(value) => {
              setCityVisible(value);
              notify(value ? '已开启同城可见（演示）' : '已关闭同城可见（演示）');
            }}
            trackColor={{ false: colors.line, true: colors.brand }}
            thumbColor={colors.white}
          />
        </View>
        <Text style={styles.privacyNote}>不显示学校、住址或精确位置；关闭后不会出现在同城推荐中。</Text>
        <Divider />
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchTitle}>公开我的跑步记录</Text>
            <Text style={styles.switchHint}>默认仅自己与跑团可见</Text>
          </View>
          <Switch
            value={recordVisible}
            onValueChange={(value) => {
              setRecordVisible(value);
              notify(value ? '已公开跑步记录（演示）' : '已设为仅团内可见（演示）');
            }}
            trackColor={{ false: colors.line, true: colors.brand }}
            thumbColor={colors.white}
          />
        </View>
        <Text style={styles.privacyNote}>公开范围不含精确轨迹；未成年人默认关闭。</Text>
        <Divider />
        <Pressable
          onPress={() => notify('监护人授权：正式版会发送授权链接给监护人')}
          style={styles.guardianRow}>
          <View style={styles.guardianText}>
            <Text style={styles.switchTitle}>监护人授权</Text>
            <Text style={styles.switchHint}>参加线下活动前需完成</Text>
          </View>
          <Pill text="待完成" tone="gold" />
        </Pressable>
        <Text style={styles.privacyNote}>未满 18 岁参加线下活动，需要监护人知情并确认活动风险。</Text>
      </Card>

      <SectionTitle title="设置" />
      <Card style={styles.listCard}>
        <ListRow glyph="铃" title="通知设置" subtitle="活动提醒、周报与审核结果" onPress={() => notify('通知设置：演示版暂未开放')} />
        <Divider />
        <ListRow glyph="信" title="意见反馈" subtitle="帮助我们把青跑团做得更稳" onPress={() => notify('意见反馈：演示版暂未开放')} />
        <Divider />
        <ListRow glyph="青" title="关于青跑团" subtitle="v0.1 演示版 · 公益长跑成长平台" onPress={() => notify('青跑团 v0.1 演示版')} />
      </Card>

      <PrimaryButton
        label="退出登录"
        variant="outline"
        onPress={logout}
        style={styles.logout}
      />

      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  userCard: { padding: space.lg },
  userTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  userInfo: { flex: 1, gap: 4 },
  userName: { fontSize: 20, fontWeight: '800', color: colors.ink },
  userSchool: { fontSize: 11, color: colors.muted },
  editText: { fontSize: 12, fontWeight: '700', color: colors.brand, paddingTop: 4 },
  userStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  userStat: { flex: 1, alignItems: 'flex-start' },
  userStatValue: { fontSize: 17, fontWeight: '800', color: colors.brand },
  userStatLabel: { marginTop: 2, fontSize: 10, color: colors.muted },
  userStatDivider: { width: 1, height: 26, backgroundColor: colors.line },
  toast: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    fontSize: 11,
    lineHeight: 16,
    color: colors.brand,
  },
  listCard: { paddingVertical: 2 },
  charityCard: { padding: space.lg, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  charityTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  charityMeta: { fontSize: 9, color: colors.accent },
  charityTitle: { marginTop: 10, fontSize: 18, fontWeight: '800', lineHeight: 25, color: colors.ink },
  charityBody: { marginTop: 7, fontSize: 11, lineHeight: 18, color: colors.inkSoft },
  charityButton: { marginTop: 14 },
  privacyCard: { padding: space.lg },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchText: { flex: 1, gap: 3 },
  switchTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  switchHint: { fontSize: 10, color: colors.muted },
  privacyNote: { marginTop: 6, fontSize: 9, lineHeight: 15, color: colors.muted },
  guardianRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  guardianText: { flex: 1, gap: 3 },
  logout: { marginTop: 18 },
});
