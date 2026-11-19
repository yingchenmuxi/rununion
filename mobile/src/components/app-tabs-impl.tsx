import { Slot, usePathname, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/constants/qingrun';

const TABS = [
  { name: 'home', href: '/', label: '首页', glyph: '家' },
  { name: 'school', href: '/school', label: '跑团', glyph: '团' },
  { name: 'run', href: '/run', label: '开跑', glyph: '跑' },
  { name: 'growth', href: '/growth', label: '成长', glyph: '长' },
  { name: 'profile', href: '/profile', label: '我的', glyph: '我' },
] as const;

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const router = useRouter();
  const isDesktop = Platform.OS === 'web' && width > 720;

  return (
    <View style={[styles.page, isDesktop && styles.pageDesktop]}>
      <View style={[styles.shell, isDesktop && styles.shellDesktop]}>
        <View style={styles.slot}>
          <Slot />
        </View>
        <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.bar}>
            {TABS.map((tab) => {
              const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
              return (
                <Pressable
                  key={tab.name}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => router.replace(tab.href as any)}
                  style={styles.tabButton}>
                  <View style={[styles.glyphBox, active && styles.glyphBoxActive]}>
                    <Text style={[styles.glyph, active && styles.glyphActive]}>{tab.glyph}</Text>
                  </View>
                  <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%', backgroundColor: colors.page, alignItems: 'center' },
  pageDesktop: { justifyContent: 'center', paddingVertical: space.xxl, paddingHorizontal: space.lg },
  shell: { flex: 1, width: '100%', maxWidth: 520, backgroundColor: colors.bg },
  shellDesktop: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#14201B',
    shadowOpacity: 0.12,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  slot: { flex: 1 },
  barWrap: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: space.sm,
    paddingHorizontal: space.sm,
  },
  bar: { flexDirection: 'row', alignItems: 'center' },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 3 },
  glyphBox: { width: 30, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  glyphBoxActive: { backgroundColor: colors.brand },
  glyph: { fontSize: 12, fontWeight: '800', color: colors.muted },
  glyphActive: { color: colors.white },
  label: { fontSize: 10, fontWeight: '600', color: colors.muted },
  labelActive: { color: colors.brand, fontWeight: '800' },
});
