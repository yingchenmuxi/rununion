import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, space } from '@/constants/qingrun';

export function Screen({ children, contentStyle }: { children: ReactNode; contentStyle?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.screenContent,
        { paddingTop: Math.max(insets.top, 12) + (Platform.OS === 'web' ? 10 : 6) },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.inner}>{children}</View>
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type PillTone = 'neutral' | 'green' | 'gold' | 'coral' | 'onDark';

export function Pill({ text, tone = 'neutral' }: { text: string; tone?: PillTone }) {
  return (
    <View style={[styles.pill, pillStyles[tone]]}>
      <Text style={[styles.pillText, pillTextStyles[tone]]}>{text}</Text>
    </View>
  );
}

const avatarPalette = [colors.brandSoft, colors.accentSoft, colors.goldSoft, '#E8EDF7'];
const avatarTextPalette = [colors.brand, colors.accent, colors.gold, '#3E5C8A'];

export function Avatar({ label, size = 36, tone = 0 }: { label: string; size?: number; tone?: number }) {
  const i = Math.abs(tone) % avatarPalette.length;
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarPalette[i] },
      ]}>
      <Text style={[styles.avatarText, { color: avatarTextPalette[i], fontSize: size * 0.38 }]}>{label}</Text>
    </View>
  );
}

export function Stat({ value, label, tone = 'default' }: { value: string; label: string; tone?: 'default' | 'onDark' }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone === 'onDark' && styles.onDarkText]}>{value}</Text>
      <Text style={[styles.statLabel, tone === 'onDark' && styles.onDarkMuted]}>{label}</Text>
    </View>
  );
}

type ButtonVariant = 'brand' | 'accent' | 'light' | 'outline';

export function PrimaryButton({
  label,
  onPress,
  variant = 'brand',
  glyph,
  style,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  glyph?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        buttonVariants[variant],
        style,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {glyph ? <Text style={[styles.buttonGlyph, buttonTextVariants[variant]]}>{glyph}</Text> : null}
      <Text style={[styles.buttonText, buttonTextVariants[variant]]}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'onDark' }) {
  const safe = Math.min(100, Math.max(0, value));
  return (
    <View style={[styles.progressTrack, tone === 'onDark' && styles.progressTrackDark]}>
      <View
        style={[
          styles.progressFill,
          tone === 'onDark' ? styles.progressFillDark : styles.progressFillBrand,
          { width: (safe + '%') as any },
        ]}
      />
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function ListRow({
  glyph,
  title,
  subtitle,
  right,
  onPress,
}: {
  glyph: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}>
      <View style={styles.listGlyph}>
        <Text style={styles.listGlyphText}>{glyph}</Text>
      </View>
      <View style={styles.listText}>
        <Text style={styles.listTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.listRight}>
        {typeof right === 'string' ? <Text style={styles.listRightText}>{right}</Text> : right}
        {onPress ? <Text style={styles.chevron}>›</Text> : null}
      </View>
    </Pressable>
  );
}

export function AppHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.appHeader}>
      <View style={styles.appHeaderText}>
        <Text style={styles.appHeaderKicker}>青跑团</Text>
        <Text style={styles.appHeaderTitle}>{title}</Text>
        {subtitle ? <Text style={styles.appHeaderSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function DemoNote() {
  return <Text style={styles.demoNote}>演示数据 · 本次打开内有效，刷新会恢复</Text>;
}

const pillStyles: Record<PillTone, ViewStyle> = {
  neutral: { backgroundColor: '#F1EDE4' },
  green: { backgroundColor: colors.brandSoft },
  gold: { backgroundColor: colors.goldSoft },
  coral: { backgroundColor: colors.accentSoft },
  onDark: { backgroundColor: 'rgba(255,255,255,0.14)' },
};

const pillTextStyles: Record<PillTone, TextStyle> = {
  neutral: { color: colors.muted },
  green: { color: colors.brand },
  gold: { color: colors.gold },
  coral: { color: colors.accent },
  onDark: { color: colors.white },
};

const buttonVariants: Record<ButtonVariant, ViewStyle> = {
  brand: { backgroundColor: colors.brand },
  accent: { backgroundColor: colors.accent },
  light: { backgroundColor: colors.brandSoft },
  outline: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
};

const buttonTextVariants: Record<ButtonVariant, TextStyle> = {
  brand: { color: colors.white },
  accent: { color: colors.white },
  light: { color: colors.brand },
  outline: { color: colors.ink },
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { paddingBottom: space.xxxl },
  inner: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
  sectionTitleRow: {
    marginTop: space.xxl,
    marginBottom: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, letterSpacing: 0.2 },
  sectionAction: { fontSize: 12, fontWeight: '700', color: colors.brand },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800' },
  stat: { alignItems: 'flex-start' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.muted, marginTop: 2 },
  onDarkText: { color: colors.white },
  onDarkMuted: { color: 'rgba(255,255,255,0.68)' },
  button: {
    minHeight: 46,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: space.lg,
  },
  buttonGlyph: { fontSize: 12, fontWeight: '800' },
  buttonText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  progressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.brandSoft, overflow: 'hidden' },
  progressTrackDark: { backgroundColor: 'rgba(255,255,255,0.18)' },
  progressFill: { height: 8, borderRadius: radius.pill },
  progressFillBrand: { backgroundColor: colors.brand },
  progressFillDark: { backgroundColor: '#F2C66D' },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  listGlyph: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listGlyphText: { fontSize: 13, fontWeight: '800', color: colors.brand },
  listText: { flex: 1, gap: 2 },
  listTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  listSubtitle: { fontSize: 11, lineHeight: 16, color: colors.muted },
  listRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listRightText: { fontSize: 11, fontWeight: '600', color: colors.muted },
  chevron: { fontSize: 20, color: colors.muted, marginTop: -2 },
  appHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: space.lg },
  appHeaderText: { flex: 1 },
  appHeaderKicker: { fontSize: 11, fontWeight: '800', color: colors.brand, letterSpacing: 1.5, marginBottom: 4 },
  appHeaderTitle: { fontSize: 28, fontWeight: '800', color: colors.ink, letterSpacing: 0.2 },
  appHeaderSubtitle: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 4 },
  demoNote: { fontSize: 10, color: colors.muted, textAlign: 'center', marginTop: space.xxl, marginBottom: space.sm },
});
