import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, DemoNote, Pill, PrimaryButton, Screen } from '@/components/qingrun-ui';
import { colors, mock, radius, space } from '@/constants/qingrun';
import { DEMO_INVITE, DEMO_PASSWORD, DEMO_USERNAME, useAuth } from '@/features/auth/AuthContext';

const GRADES = ['初三', '高一', '高二', '高三', '大学/其他'];

type Mode = 'login' | 'join';

export function AuthScreen() {
  const { login, requestJoin } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [joinStep, setJoinStep] = useState<'code' | 'profile'>('code');
  const [invite, setInvite] = useState('');
  const [codeError, setCodeError] = useState('');
  const [nickname, setNickname] = useState('');
  const [grade, setGrade] = useState('高一');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [joinError, setJoinError] = useState('');

  const switchMode = (next: Mode) => {
    setMode(next);
    setLoginError('');
    setJoinError('');
    if (next === 'join') {
      setJoinStep('code');
      setCodeError('');
    }
  };

  const handleLogin = () => {
    setLoginError('');
    const error = login(loginName, loginPassword);
    if (error) setLoginError(error);
  };

  const handleVerifyCode = () => {
    setCodeError('');
    if (invite.trim().toUpperCase() !== DEMO_INVITE) {
      setCodeError('邀请码不对，请向社长要一个新的邀请码。');
      return;
    }
    setJoinStep('profile');
  };

  const handleJoin = () => {
    setJoinError('');
    if (nickname.trim().length < 2) {
      setJoinError('昵称至少 2 个字，方便社团里的同学认识你。');
      return;
    }
    if (username.trim().length < 3) {
      setJoinError('用户名至少 3 个字符。');
      return;
    }
    if (password.length < 6) {
      setJoinError('密码至少 6 位。');
      return;
    }
    const error = requestJoin({ nickname, grade, username, password, inviteCode: invite });
    if (error) setJoinError(error);
  };

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>青</Text>
        </View>
        <View>
          <Text style={styles.brandName}>青跑团</Text>
          <Text style={styles.brandClub}>{mock.club.name}</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.kicker}>北京 · 青少年长跑</Text>
        <Text style={styles.title}>先入团，<Text style={styles.titleAccent}>再一起跑。</Text></Text>
        <Text style={styles.subtitle}>记录成长，不制造内卷。每一次坚持，都值得被看见。</Text>
      </View>

      <Card style={styles.card}>
        <View style={styles.segment}>
          <Pressable
            onPress={() => switchMode('login')}
            style={[styles.segmentButton, mode === 'login' && styles.segmentButtonActive]}>
            <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>登录</Text>
          </Pressable>
          <Pressable
            onPress={() => switchMode('join')}
            style={[styles.segmentButton, mode === 'join' && styles.segmentButtonActive]}>
            <Text style={[styles.segmentText, mode === 'join' && styles.segmentTextActive]}>我有邀请码</Text>
          </Pressable>
        </View>

        {mode === 'login' ? (
          <View style={styles.form}>
            <Text style={styles.formTitle}>回到跑道</Text>
            <Text style={styles.formHint}>用用户名和密码登录。忘记密码请找社长重置。</Text>

            <Text style={styles.label}>用户名</Text>
            <TextInput
              value={loginName}
              onChangeText={setLoginName}
              placeholder="输入用户名"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Text style={styles.label}>密码</Text>
            <TextInput
              value={loginPassword}
              onChangeText={setLoginPassword}
              placeholder="输入密码"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
            />

            {loginError ? <Text style={styles.error}>{loginError}</Text> : null}

            <PrimaryButton label="进入跑团" onPress={handleLogin} style={styles.submit} />

            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>本地演示账号</Text>
              <Text style={styles.demoText}>
                {DEMO_USERNAME} / {DEMO_PASSWORD}
              </Text>
              <Pressable
                onPress={() => {
                  setLoginName(DEMO_USERNAME);
                  setLoginPassword(DEMO_PASSWORD);
                  setLoginError('');
                }}
                hitSlop={8}>
                <Text style={styles.demoFill}>填入演示账号</Text>
              </Pressable>
            </View>
          </View>
        ) : joinStep === 'code' ? (
          <View style={styles.form}>
            <Text style={styles.formTitle}>找到你的跑团</Text>
            <Text style={styles.formHint}>邀请码由社长在管理后台生成，一个码对应一个社团。</Text>

            <Text style={styles.label}>邀请码</Text>
            <TextInput
              value={invite}
              onChangeText={setInvite}
              placeholder="例如 KANGFU-2026"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />

            {codeError ? <Text style={styles.error}>{codeError}</Text> : null}

            <PrimaryButton label="验证邀请码" onPress={handleVerifyCode} style={styles.submit} />

            <Pressable
              onPress={() => {
                setInvite(DEMO_INVITE);
                setCodeError('');
              }}
              hitSlop={8}>
              <Text style={styles.demoFill}>填入演示邀请码 {DEMO_INVITE}</Text>
            </Pressable>

            <View style={styles.clubPreview}>
              <View style={styles.clubMark}>
                <Text style={styles.clubMarkText}>康</Text>
              </View>
              <View style={styles.clubInfo}>
                <Text style={styles.clubName}>{mock.club.name}</Text>
                <Text style={styles.clubMeta}>
                  {mock.club.city} · {mock.club.members} 名成员 · 已认证
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.verifiedRow}>
              <Pill text="邀请码有效" tone="green" />
              <Text style={styles.verifiedText}>接下来填写入团资料。</Text>
            </View>

            <Text style={styles.label}>昵称</Text>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="社团里怎么称呼你"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />

            <Text style={styles.label}>年级</Text>
            <View style={styles.gradeRow}>
              {GRADES.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setGrade(item)}
                  style={[styles.gradeChip, grade === item && styles.gradeChipActive]}>
                  <Text style={[styles.gradeText, grade === item && styles.gradeTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>用户名</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="3–20 个字符，登录时使用"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Text style={styles.label}>密码</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="至少 6 位"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
            />

            {joinError ? <Text style={styles.error}>{joinError}</Text> : null}

            <PrimaryButton label="提交入团申请" onPress={handleJoin} style={styles.submit} />
            <Text style={styles.formFootnote}>提交后由社长在后台审批；演示版提供“一键通过”按钮。</Text>
          </View>
        )}
      </Card>

      <Text style={styles.privacy}>
        面向 14 岁以上青少年。演示版只在本机运行，不会上传真实资料。
      </Text>
      <DemoNote />
    </Screen>
  );
}

export function PendingScreen() {
  const { profile, approveDemo, logout } = useAuth();
  const name = profile?.nickname ?? '新同学';

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>青</Text>
        </View>
        <View>
          <Text style={styles.brandName}>青跑团</Text>
          <Text style={styles.brandClub}>{mock.club.name}</Text>
        </View>
      </View>

      <Card style={styles.pendingCard}>
        <View style={styles.pendingMark}>
          <Text style={styles.pendingMarkText}>康</Text>
        </View>
        <Pill text="待社长审批" tone="gold" />
        <Text style={styles.pendingTitle}>申请已提交</Text>
        <Text style={styles.pendingBody}>
          {name + '，你的入团申请已经记下了。社长会在管理后台看到你的昵称、年级和申请时间。'}
        </Text>

        <View style={styles.pendingSteps}>
          <View style={styles.pendingStep}>
            <Text style={styles.pendingStepNumber}>1</Text>
            <Text style={styles.pendingStepText}>社长在后台查看申请</Text>
          </View>
          <View style={styles.pendingStep}>
            <Text style={styles.pendingStepNumber}>2</Text>
            <Text style={styles.pendingStepText}>通过后就能看到跑团动态和挑战</Text>
          </View>
        </View>

        <PrimaryButton label="演示：立即通过" onPress={approveDemo} style={[styles.submit, styles.pendingButton]} />
        <PrimaryButton label="返回登录" variant="outline" onPress={logout} style={[styles.secondary, styles.pendingButton]} />
      </Card>

      <Text style={styles.privacy}>
        正式版必须由社长在管理后台审批，成员不能自己通过。这里的按钮只用于演示。
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 36 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { fontSize: 19, fontWeight: '800', color: colors.white },
  brandName: { fontSize: 18, fontWeight: '800', color: colors.ink, letterSpacing: 0.4 },
  brandClub: { marginTop: 2, fontSize: 10, color: colors.muted },
  hero: { marginTop: 34, marginBottom: 22 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: colors.brand },
  title: { marginTop: 10, fontSize: 34, lineHeight: 44, fontWeight: '800', color: colors.ink },
  titleAccent: { color: colors.brand },
  subtitle: { marginTop: 12, fontSize: 13, lineHeight: 22, color: colors.muted },
  card: { padding: space.lg },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 13 },
  segmentButtonActive: { backgroundColor: colors.card },
  segmentText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  segmentTextActive: { color: colors.brand },
  form: { marginTop: 20 },
  formTitle: { fontSize: 21, fontWeight: '800', color: colors.ink },
  formHint: { marginTop: 5, marginBottom: 14, fontSize: 11, lineHeight: 18, color: colors.muted },
  label: { marginTop: 12, marginBottom: 6, fontSize: 11, fontWeight: '700', color: colors.inkSoft },
  input: {
    minHeight: 44,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    fontSize: 14,
    color: colors.ink,
  },
  error: { marginTop: 10, fontSize: 11, lineHeight: 17, color: colors.danger },
  submit: { marginTop: 16 },
  demoBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    gap: 4,
  },
  demoTitle: { fontSize: 10, fontWeight: '700', color: colors.muted },
  demoText: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  demoFill: { marginTop: 4, fontSize: 11, fontWeight: '700', color: colors.brand },
  clubPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 18,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  clubMark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubMarkText: { fontSize: 18, fontWeight: '800', color: colors.brand },
  clubInfo: { flex: 1, gap: 3 },
  clubName: { fontSize: 13, fontWeight: '800', color: colors.ink },
  clubMeta: { fontSize: 10, color: colors.muted },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  verifiedText: { fontSize: 11, color: colors.muted },
  gradeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  gradeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  gradeChipActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  gradeText: { fontSize: 11, color: colors.inkSoft },
  gradeTextActive: { color: colors.brand, fontWeight: '800' },
  formFootnote: { marginTop: 10, fontSize: 9, lineHeight: 15, color: colors.muted },
  privacy: {
    marginTop: 18,
    paddingHorizontal: 4,
    fontSize: 9,
    lineHeight: 15,
    color: colors.muted,
    textAlign: 'center',
  },
  pendingCard: { marginTop: 34, padding: 22, alignItems: 'flex-start' },
  pendingMark: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pendingMarkText: { fontSize: 26, fontWeight: '800', color: colors.brand },
  pendingTitle: { marginTop: 12, fontSize: 26, fontWeight: '800', color: colors.ink },
  pendingBody: { marginTop: 10, fontSize: 12, lineHeight: 20, color: colors.inkSoft },
  pendingSteps: { alignSelf: 'stretch', marginTop: 20, padding: 14, borderRadius: radius.md, backgroundColor: colors.bg, gap: 10 },
  pendingStep: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  pendingStepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 10,
    fontWeight: '800',
    color: colors.brand,
    backgroundColor: colors.brandSoft,
    overflow: 'hidden',
  },
  pendingStepText: { flex: 1, fontSize: 11, color: colors.inkSoft },
  pendingButton: { alignSelf: 'stretch' },
  secondary: { marginTop: 9 },
});
