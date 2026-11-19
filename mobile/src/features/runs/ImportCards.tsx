import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { Card, PrimaryButton, SectionTitle } from '@/components/qingrun-ui';
import { colors, radius, space } from '@/constants/qingrun';
import { parseRunFile, type ImportedRun } from '@/features/runs/importers';
import { useRuns } from '@/features/runs/RunContext';

type Notice = { tone: 'error' | 'success'; text: string };

function toNumber(value: string) {
  return Number(value.replace(',', '.'));
}

function validRun(distanceKm: number, durationMin: number) {
  return Number.isFinite(distanceKm) && distanceKm >= 0.1 && distanceKm <= 100 && Number.isFinite(durationMin) && durationMin >= 1 && durationMin <= 600;
}

function NoticeLine({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <View style={[styles.notice, notice.tone === 'error' ? styles.noticeError : styles.noticeSuccess]}>
      <Text style={[styles.noticeText, notice.tone === 'error' ? styles.noticeTextError : styles.noticeTextSuccess]}>{notice.text}</Text>
    </View>
  );
}

export function ScreenshotImportCard() {
  const { addRun } = useRuns();
  const [uri, setUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  const pick = async () => {
    setNotice(null);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setNotice({ tone: 'error', text: '没有相册权限，无法选择截图。' });
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.6,
      });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      setUri(asset.uri);
      setFileName(asset.fileName ?? '跑步截图');
      setNotice({ tone: 'success', text: '截图已选好。请对照图片填写距离和时长，再确认保存。' });
    } catch {
      setNotice({ tone: 'error', text: '没能打开相册，请稍后重试。' });
    }
  };

  const save = () => {
    const km = toNumber(distance);
    const minutes = toNumber(duration);
    if (!validRun(km, minutes)) {
      setNotice({ tone: 'error', text: '距离请填 0.1–100 km，时长请填 1–600 分钟。' });
      return;
    }
    const record = addRun({
      title: note.trim() || fileName.replace(/\.[^.]+$/, '') || '截图导入',
      distanceKm: km,
      durationMin: minutes,
      source: 'screenshot',
    });
    setNotice({ tone: 'success', text: '已保存 ' + record.distanceKm.toFixed(1) + ' km，来源记为“截图导入”。' });
    setUri(null);
    setFileName('');
    setDistance('');
    setDuration('');
    setNote('');
  };

  return (
    <>
      <SectionTitle title="截图导入" action="先选图，再确认" />
      <Card style={styles.card}>
        <Text style={styles.hint}>在其他运动软件里截一张完成页，选进来核对数字。演示版不自动识别图片文字，保存前由你确认。</Text>
        {uri ? <Image source={{ uri }} style={styles.preview} resizeMode="contain" /> : null}
        <PrimaryButton label={uri ? '重新选择截图' : '选择跑步截图'} variant="light" onPress={pick} style={styles.pickButton} />
        {uri ? (
          <>
            <Text style={styles.fileName}>{fileName}</Text>
            <View style={styles.inputRow}>
              <TextInput
                value={distance}
                onChangeText={setDistance}
                placeholder="截图里的距离 km"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                maxLength={5}
                style={styles.input}
              />
              <TextInput
                value={duration}
                onChangeText={setDuration}
                placeholder="截图里的时长 分钟"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={3}
                style={styles.input}
              />
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="备注，如 Keep 5K 完成页（选填）"
              placeholderTextColor={colors.muted}
              maxLength={24}
              style={[styles.input, styles.fullInput]}
            />
            <PrimaryButton label="确认并保存" onPress={save} style={styles.saveButton} />
          </>
        ) : null}
        <NoticeLine notice={notice} />
      </Card>
    </>
  );
}

async function readDocument(asset: DocumentPicker.DocumentPickerAsset) {
  const file = (asset as DocumentPicker.DocumentPickerAsset & { file?: { text: () => Promise<string> } }).file;
  if (file && typeof file.text === 'function') return file.text();
  try {
    const response = await fetch(asset.uri);
    if (response.ok) return response.text();
  } catch {
    // 手机端 file:// 地址交给 FileSystem 读取。
  }
  return FileSystem.readAsStringAsync(asset.uri);
}

export function FileImportCard() {
  const { addRun } = useRuns();
  const [fileName, setFileName] = useState('');
  const [draft, setDraft] = useState<ImportedRun | null>(null);
  const [count, setCount] = useState(0);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  const pick = async () => {
    setNotice(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/gpx+xml', 'application/xml', 'text/xml', 'application/octet-stream'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      const content = await readDocument(asset);
      const parsed = parseRunFile(asset.name, content);
      if (!parsed.ok) {
        setDraft(null);
        setNotice({ tone: 'error', text: parsed.error });
        return;
      }
      const first = parsed.runs[0];
      setFileName(asset.name);
      setDraft(first);
      setCount(parsed.runs.length);
      setDistance(first.distanceKm.toFixed(2));
      setDuration(first.durationMin.toFixed(1));
      setNote(first.note);
      setNotice({
        tone: 'success',
        text: '已读取 ' + first.distanceKm.toFixed(2) + ' km / ' + first.durationMin.toFixed(1) + ' 分钟，请确认后保存。',
      });
    } catch {
      setNotice({ tone: 'error', text: '文件读取失败，请换成 GPX、TCX 或 CSV。' });
    }
  };

  const save = () => {
    if (!draft) return;
    const km = toNumber(distance);
    const minutes = toNumber(duration);
    if (!validRun(km, minutes)) {
      setNotice({ tone: 'error', text: '距离请填 0.1–100 km，时长请填 1–600 分钟。' });
      return;
    }
    const record = addRun({
      title: note.trim() || draft.title,
      distanceKm: km,
      durationMin: minutes,
      date: draft.date,
      source: 'file',
    });
    setNotice({
      tone: 'success',
      text: '已保存 ' + record.distanceKm.toFixed(1) + ' km，来源记为“文件导入”。' + (count > 1 ? ' 本次只保存了第 1 条，共读取 ' + count + ' 条。' : ''),
    });
    setDraft(null);
    setFileName('');
    setDistance('');
    setDuration('');
    setNote('');
    setCount(0);
  };

  return (
    <>
      <SectionTitle title="文件导入" action="GPX · TCX · CSV" />
      <Card style={styles.card}>
        <Text style={styles.hint}>从运动手表或跑步软件导出轨迹文件，不用授权账号。FIT 是二进制格式，请先导出为 GPX、TCX 或 CSV。</Text>
        <PrimaryButton label="选择轨迹文件" variant="light" onPress={pick} style={styles.pickButton} />
        {draft ? (
          <>
            <View style={styles.fileMeta}>
              <Text style={styles.fileName}>{fileName}</Text>
              <Text style={styles.parsedLine}>{draft.date} · 已读取 {count} 条</Text>
            </View>
            <View style={styles.inputRow}>
              <TextInput value={distance} onChangeText={setDistance} placeholder="距离 km" placeholderTextColor={colors.muted} keyboardType="decimal-pad" maxLength={5} style={styles.input} />
              <TextInput value={duration} onChangeText={setDuration} placeholder="时长 分钟" placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={3} style={styles.input} />
            </View>
            <TextInput value={note} onChangeText={setNote} placeholder="备注（选填）" placeholderTextColor={colors.muted} maxLength={24} style={[styles.input, styles.fullInput]} />
            <PrimaryButton label="确认并保存" onPress={save} style={styles.saveButton} />
          </>
        ) : null}
        <NoticeLine notice={notice} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg },
  hint: { fontSize: 11, lineHeight: 18, color: colors.muted },
  preview: { width: '100%', height: 190, marginTop: 12, borderRadius: radius.md, backgroundColor: colors.bg },
  pickButton: { marginTop: 12 },
  fileName: { marginTop: 10, fontSize: 10, color: colors.muted },
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
  fullInput: { flex: 0, width: '100%', marginTop: 12 },
  saveButton: { marginTop: 12 },
  fileMeta: { marginTop: 10 },
  parsedLine: { marginTop: 3, fontSize: 10, color: colors.muted },
  notice: { marginTop: 12, paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.md },
  noticeSuccess: { backgroundColor: colors.brandSoft },
  noticeError: { backgroundColor: colors.accentSoft },
  noticeText: { fontSize: 11, lineHeight: 17, fontWeight: '600' },
  noticeTextSuccess: { color: colors.brand },
  noticeTextError: { color: colors.danger },
});
