import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  AppHeader,
  Card,
  DemoNote,
  Pill,
  PrimaryButton,
  ProgressBar,
  Screen,
  SectionTitle,
} from '@/components/qingrun-ui';
import { colors, radius, space } from '@/constants/qingrun';
import { FileImportCard, ScreenshotImportCard } from '@/features/runs/ImportCards';
import { decideGpsSegment, haversineMeters, metersToKm, type GeoPoint } from '@/features/runs/geo';
import { RUN_SOURCE_LABELS, formatDuration, formatPace, formatRunDate, useRuns } from '@/features/runs/RunContext';

const TARGETS = ['3K', '5K', '10K'];
const MODES = ['轻松跑', '节奏跑', '长距离'];
const WARMUPS = ['活动脚踝与膝盖', '先走 3 分钟再慢跑', '把呼吸调整到能说话'];

function formatTime(total: number) {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return String(hours) + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  }
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

type Notice = { tone: 'error' | 'success'; text: string };
type GpsStatus = 'idle' | 'requesting' | 'waiting' | 'tracking' | 'weak' | 'denied' | 'unavailable';

const GPS_LABELS: Record<GpsStatus, string> = {
  idle: 'GPS 待命',
  requesting: '请求定位',
  waiting: '正在搜星',
  tracking: 'GPS 记录中',
  weak: 'GPS 信号弱',
  denied: '未开定位',
  unavailable: '定位不可用',
};

function toNumber(value: string) {
  return Number(value.replace(',', '.'));
}

export default function RunScreen() {
  const { stats, recentRuns, addRun } = useRuns();
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [lastRun, setLastRun] = useState(0);
  const [target, setTarget] = useState('5K');
  const [mode, setMode] = useState('轻松跑');
  const [checks, setChecks] = useState([false, false, false]);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [timerDistance, setTimerDistance] = useState('');
  const [timerNotice, setTimerNotice] = useState<Notice | null>(null);
  const [manualNotice, setManualNotice] = useState<Notice | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');
  const [gpsKm, setGpsKm] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [pendingGps, setPendingGps] = useState(false);
  const gpsSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastPointRef = useRef<GeoPoint | null>(null);
  const gpsMetersRef = useRef(0);
  const trackingRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    return () => {
      gpsSubRef.current?.remove();
      gpsSubRef.current = null;
    };
  }, []);

  const stopGps = () => {
    trackingRef.current = false;
    gpsSubRef.current?.remove();
    gpsSubRef.current = null;
  };

  const startGps = async () => {
    setGpsStatus('requesting');
    setGpsAccuracy(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!trackingRef.current) return;
      if (permission.status !== 'granted') {
        setGpsStatus('denied');
        return;
      }
      setGpsStatus('waiting');
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1500,
          distanceInterval: 2,
        },
        (location) => {
          if (!trackingRef.current) return;
          const accuracy = location.coords.accuracy ?? 999;
          const point: GeoPoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy,
            timestamp: location.timestamp,
          };
          setGpsAccuracy(accuracy);
          if (accuracy > 50) {
            setGpsStatus('weak');
            return;
          }

          const last = lastPointRef.current;
          if (!last) {
            lastPointRef.current = point;
            setGpsStatus('tracking');
            return;
          }

          const segmentMeters = haversineMeters(last, point);
          const elapsedSeconds = (point.timestamp - last.timestamp) / 1000;
          const decision = decideGpsSegment({
            distanceMeters: segmentMeters,
            elapsedSeconds,
            accuracy,
          });

          if (!decision.accept) {
            if (decision.reason === 'tooFar' || decision.reason === 'tooFast') {
              lastPointRef.current = point;
            }
            return;
          }

          gpsMetersRef.current += segmentMeters;
          lastPointRef.current = point;
          setGpsKm(metersToKm(gpsMetersRef.current));
          setGpsStatus('tracking');
        },
      );
      if (!trackingRef.current) {
        subscription.remove();
        return;
      }
      gpsSubRef.current = subscription;
    } catch {
      if (trackingRef.current) setGpsStatus('unavailable');
    }
  };

  const toggleRun = () => {
    if (running) {
      stopGps();
      if (seconds < 1) {
        setRunning(false);
        setGpsStatus('idle');
        return;
      }
      const finalKm = metersToKm(gpsMetersRef.current);
      const hasGps = finalKm >= 0.05;
      setLastRun(seconds);
      setSeconds(0);
      setRunning(false);
      setPendingGps(hasGps);
      setTimerDistance(hasGps ? finalKm.toFixed(2) : '');
      setTimerNotice(null);
      setGpsStatus('idle');
      return;
    }

    trackingRef.current = true;
    gpsMetersRef.current = 0;
    lastPointRef.current = null;
    setGpsKm(0);
    setGpsAccuracy(null);
    setPendingGps(false);
    setLastRun(0);
    setSeconds(0);
    setRunning(true);
    setTimerNotice(null);
    void startGps();
  };

  const saveTimer = () => {
    const km = toNumber(timerDistance);
    if (!Number.isFinite(km) || km < 0.05 || km > 100) {
      setTimerNotice({ tone: 'error', text: '请填写 0.05–100 km 之间的本次距离。' });
      return;
    }
    const durationMin = Math.max(0.1, Math.round((lastRun / 60) * 10) / 10);
    const record = addRun({
      title: mode + ' · ' + target,
      distanceKm: km,
      durationMin,
      source: pendingGps ? 'gps' : 'manual',
    });
    setTimerNotice({
      tone: 'success',
      text: '已记录 ' + record.distanceKm.toFixed(1) + ' km，首页和成长档案已同步。',
    });
    setLastRun(0);
    setTimerDistance('');
    setPendingGps(false);
    setGpsKm(0);
    setGpsAccuracy(null);
    gpsMetersRef.current = 0;
    lastPointRef.current = null;
  };

  const saveManual = () => {
    const km = toNumber(distance);
    const minutes = toNumber(duration);
    if (!Number.isFinite(km) || km < 0.1 || km > 100) {
      setManualNotice({ tone: 'error', text: '距离请填 0.1–100 km 之间的数字。' });
      return;
    }
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) {
      setManualNotice({ tone: 'error', text: '时长请填 1–600 分钟之间的数字。' });
      return;
    }
    const record = addRun({
      title: note.trim() || mode,
      distanceKm: km,
      durationMin: minutes,
      source: 'manual',
    });
    setManualNotice({
      tone: 'success',
      text: '已记录 ' + record.distanceKm.toFixed(1) + ' km，首页和成长档案已同步。',
    });
    setDistance('');
    setDuration('');
    setNote('');
  };

  const gpsHint =
    gpsStatus === 'denied'
      ? '没有定位权限，仍可计时，结束后手动补距离。'
      : gpsStatus === 'weak'
        ? '信号弱，距离可能有偏差；结束后可手动修正。'
        : gpsStatus === 'unavailable'
          ? '当前设备定位不可用，结束后手动补距离。'
          : '距离只在本机累计，不保存轨迹。';

  return (
    <Screen>
      <AppHeader title="开跑" subtitle="不追速度，先把今天这一公里跑完。" />

      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroKicker}>今日开跑</Text>
          <Pill text={running ? '记录中' : target} tone="onDark" />
        </View>
        <Text style={styles.heroTitle}>{running ? '正在记录这一程' : '准备好，就出发'}</Text>
        <Text style={styles.timer}>{formatTime(seconds)}</Text>
        <Text style={styles.heroMeta}>
          {running ? '保持能说话的强度，身体不适立即停下。' : '在三公里、五公里或十公里之间，按自己的节奏来。'}
        </Text>
        {running ? (
          <View style={styles.gpsRow}>
            <Pill text={GPS_LABELS[gpsStatus]} tone={gpsStatus === 'tracking' ? 'onDark' : 'gold'} />
            {gpsKm > 0 ? <Text style={styles.gpsKm}>{gpsKm.toFixed(2)} km</Text> : null}
            {gpsAccuracy !== null ? <Text style={styles.gpsAccuracy}>±{Math.round(gpsAccuracy)} m</Text> : null}
          </View>
        ) : null}
        <PrimaryButton
          label={running ? '结束并保存' : '开始跑步'}
          glyph={running ? '■' : '▶'}
          variant="accent"
          onPress={toggleRun}
          style={styles.startButton}
        />
        <Text style={styles.gpsFootnote}>{running ? gpsHint : '开始后只在本机计算距离，不保存轨迹、不上传地图。'}</Text>
      </Card>

      {lastRun > 0 ? (
        <Card style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryTitle}>本次计时</Text>
            <Pill text={pendingGps ? 'GPS 已记录' : '待补距离'} tone={pendingGps ? 'green' : 'gold'} />
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{formatDuration(lastRun / 60)}</Text>
              <Text style={styles.summaryLabel}>用时</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{mode}</Text>
              <Text style={styles.summaryLabel}>类型</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{target}</Text>
              <Text style={styles.summaryLabel}>原定目标</Text>
            </View>
          </View>
          <Text style={styles.summaryNote}>
            {pendingGps
              ? '距离来自本次 GPS 记录，可手动修正。保存后同步到首页和成长档案。'
              : '没有可用的 GPS 距离，补上这次的距离后保存。保存后同步到首页和成长档案。'}
          </Text>
          <View style={styles.timerRow}>
            <TextInput
              value={timerDistance}
              onChangeText={setTimerDistance}
              placeholder={pendingGps ? 'GPS 距离，可修改' : '本次距离 km'}
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              maxLength={5}
              style={styles.timerInput}
            />
            <PrimaryButton label="保存本次" variant="light" onPress={saveTimer} style={styles.timerButton} />
          </View>
        </Card>
      ) : null}

      {timerNotice ? (
        <View style={[styles.notice, timerNotice.tone === 'error' ? styles.noticeError : styles.noticeSuccess]}>
          <Text style={[styles.noticeText, timerNotice.tone === 'error' ? styles.noticeTextError : styles.noticeTextSuccess]}>
            {timerNotice.text}
          </Text>
        </View>
      ) : null}

      <ScreenshotImportCard />
      <FileImportCard />

      <SectionTitle title="本周目标" action={stats.weekKm.toFixed(1) + ' / ' + stats.weekGoal + ' km'} />
      <Card>
        <ProgressBar value={stats.weekPercent} />
        <Text style={styles.goalHint}>
          {stats.weekGoal - stats.weekKm > 0
            ? '还差 ' + (stats.weekGoal - stats.weekKm).toFixed(1) + ' km，按自己的节奏来。'
            : '本周目标已完成，剩下的路轻松跑。'}
        </Text>
        <View style={styles.chipRow}>
          {TARGETS.map((item) => (
            <Pressable
              key={item}
              onPress={() => setTarget(item)}
              style={[styles.chip, target === item && styles.chipActive]}>
              <Text style={[styles.chipText, target === item && styles.chipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.chipRow}>
          {MODES.map((item) => (
            <Pressable
              key={item}
              onPress={() => setMode(item)}
              style={[styles.chip, mode === item && styles.chipActive]}>
              <Text style={[styles.chipText, mode === item && styles.chipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <SectionTitle title="跑前热身" />
      <Card style={styles.checkCard}>
        {WARMUPS.map((item, index) => (
          <Pressable
            key={item}
            onPress={() => setChecks((current) => current.map((value, i) => (i === index ? !value : value)))}
            style={styles.checkRow}>
            <View style={[styles.checkBox, checks[index] && styles.checkBoxOn]}>
              {checks[index] ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <Text style={[styles.checkText, checks[index] && styles.checkTextOn]}>{item}</Text>
          </Pressable>
        ))}
      </Card>

      <SectionTitle title="手动补记" action="备用" />
      <Card style={styles.manualCard}>
        <Text style={styles.manualHint}>没有截图或轨迹文件时，才用手动补记。保存后会立即更新本周跑量、本月跑量和成长记录。</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="备注，如校园环湖（选填）"
          placeholderTextColor={colors.muted}
          maxLength={24}
          style={[styles.input, styles.noteInput]}
        />
        <View style={styles.inputRow}>
          <TextInput
            value={distance}
            onChangeText={setDistance}
            placeholder="距离 km"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            maxLength={5}
            style={styles.input}
          />
          <TextInput
            value={duration}
            onChangeText={setDuration}
            placeholder="时长 分钟"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            maxLength={3}
            style={styles.input}
          />
        </View>
        <PrimaryButton label="保存记录" variant="light" onPress={saveManual} style={styles.manualButton} />
        {manualNotice ? (
          <View style={[styles.notice, manualNotice.tone === 'error' ? styles.noticeError : styles.noticeSuccess]}>
            <Text style={[styles.noticeText, manualNotice.tone === 'error' ? styles.noticeTextError : styles.noticeTextSuccess]}>
              {manualNotice.text}
            </Text>
          </View>
        ) : null}
      </Card>

      <SectionTitle title="最近记录" action="全部" />
      <Card>
        {recentRuns.slice(0, 5).map((run, index) => (
          <View key={run.id} style={[styles.runRow, index > 0 && styles.runRowLine]}>
            <View style={styles.runDate}>
              <Text style={styles.runDateText}>{formatRunDate(run.date)}</Text>
            </View>
            <View style={styles.runInfo}>
              <Text style={styles.runTitle}>{run.title}</Text>
              <Text style={styles.runMeta}>
                {run.distanceKm.toFixed(1)} km · {formatDuration(run.durationMin)} · {formatPace(run.distanceKm, run.durationMin)} · {RUN_SOURCE_LABELS[run.source]}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <Card style={styles.safetyCard}>
        <Text style={styles.safetyTitle}>安全第一</Text>
        <Text style={styles.safetyBody}>
          尽量结伴跑，提前告诉家长路线；不闯红灯、不占机动车道；出现胸闷、头晕或疼痛时立即停止。
        </Text>
      </Card>

      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { padding: space.lg, backgroundColor: colors.brand, borderColor: colors.brand },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroKicker: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  heroTitle: { marginTop: 8, fontSize: 20, fontWeight: '800', color: colors.white },
  timer: { marginTop: 10, fontSize: 52, lineHeight: 58, fontWeight: '800', color: colors.white, letterSpacing: 1 },
  heroMeta: { marginTop: 4, fontSize: 11, lineHeight: 17, color: 'rgba(255,255,255,0.7)' },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  gpsKm: { fontSize: 13, fontWeight: '800', color: colors.white },
  gpsAccuracy: { fontSize: 10, color: 'rgba(255,255,255,0.62)' },
  gpsFootnote: { marginTop: 8, fontSize: 10, lineHeight: 15, color: 'rgba(255,255,255,0.55)' },
  startButton: { marginTop: 16 },
  summaryCard: { marginTop: 12, padding: space.lg },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  summaryStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  summaryStat: { flex: 1, alignItems: 'flex-start' },
  summaryValue: { fontSize: 18, fontWeight: '800', color: colors.brand },
  summaryLabel: { marginTop: 2, fontSize: 10, color: colors.muted },
  summaryNote: { marginTop: 12, fontSize: 11, lineHeight: 17, color: colors.muted },
  timerRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  timerInput: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.ink,
  },
  timerButton: { minWidth: 116 },
  notice: { marginTop: 12, paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.md },
  noticeSuccess: { backgroundColor: colors.brandSoft },
  noticeError: { backgroundColor: colors.accentSoft },
  noticeText: { fontSize: 11, lineHeight: 17, fontWeight: '600' },
  noticeTextSuccess: { color: colors.brand },
  noticeTextError: { color: colors.danger },
  goalHint: { marginTop: 10, fontSize: 12, color: colors.muted },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  chipTextActive: { color: colors.white },
  checkCard: { paddingVertical: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkMark: { fontSize: 12, fontWeight: '800', color: colors.white },
  checkText: { flex: 1, fontSize: 13, color: colors.inkSoft },
  checkTextOn: { color: colors.muted, textDecorationLine: 'line-through' },
  manualCard: { padding: space.lg },
  manualHint: { fontSize: 11, lineHeight: 17, color: colors.muted },
  noteInput: { flex: 0, width: '100%', marginTop: 12 },
  inputRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  input: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.ink,
  },
  manualButton: { marginTop: 12 },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  runRowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  runDate: { width: 66 },
  runDateText: { fontSize: 10, color: colors.muted },
  runInfo: { flex: 1, gap: 3 },
  runTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  runMeta: { fontSize: 10, color: colors.muted },
  safetyCard: { marginTop: 16, padding: space.lg, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  safetyTitle: { fontSize: 13, fontWeight: '800', color: colors.danger },
  safetyBody: { marginTop: 5, fontSize: 11, lineHeight: 18, color: colors.inkSoft },
});
