import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, DemoNote, Pill, PrimaryButton, Screen, SectionTitle } from '@/components/qingrun-ui';
import { colors, radius, space } from '@/constants/qingrun';
import { useKnowledge } from '@/features/knowledge/KnowledgeContext';
import {
  getKnowledgeArticle,
  type KnowledgeArticle,
} from '@/features/knowledge/knowledgeData';

export default function KnowledgeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { isSaved, toggleSaved } = useKnowledge();
  const article = getKnowledgeArticle(id);

  const goBack = () => router.replace('/knowledge');

  if (!article) {
    return (
      <Screen>
        <View style={styles.backRow}>
          <Pressable onPress={goBack} hitSlop={10}>
            <Text style={styles.backText}>‹ 返回知识库</Text>
          </Pressable>
        </View>
        <Card style={styles.notFoundCard}>
          <Text style={styles.notFoundTitle}>这篇内容不在了</Text>
          <Text style={styles.notFoundBody}>可能是链接不完整，回到知识库重新选一篇。</Text>
          <PrimaryButton label="回到知识库" onPress={goBack} style={styles.notFoundButton} />
        </Card>
        <DemoNote />
      </Screen>
    );
  }

  const saved = isSaved(article.id);
  const relatedArticles = article.related
    .map((relatedId) => getKnowledgeArticle(relatedId))
    .filter((item): item is KnowledgeArticle => Boolean(item));

  return (
    <Screen>
      <View style={styles.backRow}>
        <Pressable onPress={goBack} hitSlop={10}>
          <Text style={styles.backText}>‹ 返回知识库</Text>
        </Pressable>
        <Text style={styles.backMeta}>演示文章</Text>
      </View>

      <View style={styles.head}>
        <View style={styles.pillRow}>
          <Pill text={article.category} tone="green" />
          {article.featured ? <Pill text="本周精选" tone="gold" /> : null}
        </View>
        <Text style={styles.headTitle}>{article.title}</Text>
        <Text style={styles.headSummary}>{article.summary}</Text>
        <Text style={styles.headMeta}>
          {article.minutes} 分钟阅读 · {article.level} · 面向青少年跑者
        </Text>
      </View>

      <Card style={styles.bodyCard}>
        {article.body.map((paragraph, index) => (
          <Text
            key={paragraph}
            style={[styles.bodyText, index === article.body.length - 1 && styles.bodyTextLast]}>
            {paragraph}
          </Text>
        ))}
      </Card>

      <SectionTitle title="今天就能做" />
      <Card style={styles.checkCard}>
        {article.checklist.map((item) => (
          <View key={item} style={styles.checkRow}>
            <View style={styles.checkIcon}>
              <Text style={styles.checkMark}>✓</Text>
            </View>
            <Text style={styles.checkText}>{item}</Text>
          </View>
        ))}
      </Card>

      {article.warning ? (
        <View style={styles.warningCard}>
          <Pill text="注意" tone="coral" />
          <Text style={styles.warningText}>{article.warning}</Text>
        </View>
      ) : null}

      <PrimaryButton
        label={saved ? '已收藏（点击取消）' : '收藏这篇'}
        variant={saved ? 'light' : 'brand'}
        onPress={() => toggleSaved(article.id)}
        style={styles.saveButton}
      />
      <Text style={styles.saveNote}>收藏只保存在本次演示中，刷新后会恢复初始状态。</Text>

      {relatedArticles.length > 0 ? (
        <>
          <SectionTitle title="接着读" />
          {relatedArticles.map((item) => (
            <Card
              key={item.id}
              onPress={() => router.replace('/knowledge/' + item.id)}
              style={styles.relatedCard}>
              <View style={styles.relatedTop}>
                <Pill text={item.category} tone="neutral" />
                <Text style={styles.relatedMeta}>{item.minutes} 分钟</Text>
              </View>
              <Text style={styles.relatedTitle}>{item.title}</Text>
              <Text style={styles.relatedArrow}>读这篇 ›</Text>
            </Card>
          ))}
        </>
      ) : null}

      <PrimaryButton label="返回知识库" variant="outline" onPress={goBack} style={styles.backButton} />
      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backText: { fontSize: 12, fontWeight: '800', color: colors.brand },
  backMeta: { fontSize: 10, color: colors.muted },
  head: { marginBottom: 18 },
  pillRow: { flexDirection: 'row', gap: 6 },
  headTitle: {
    marginTop: 12,
    fontSize: 27,
    lineHeight: 37,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.2,
  },
  headSummary: { marginTop: 8, fontSize: 13, lineHeight: 21, color: colors.inkSoft },
  headMeta: { marginTop: 10, fontSize: 10, color: colors.muted },
  bodyCard: { padding: 18 },
  bodyText: { fontSize: 13, lineHeight: 23, color: colors.inkSoft, marginBottom: 14 },
  bodyTextLast: { marginBottom: 0 },
  checkCard: { paddingVertical: 16, gap: 13 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkIcon: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 11, fontWeight: '800', color: colors.brand },
  checkText: { flex: 1, fontSize: 12, lineHeight: 19, color: colors.ink },
  warningCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  warningText: { marginTop: 8, fontSize: 11, lineHeight: 18, color: colors.inkSoft },
  saveButton: { marginTop: 18 },
  saveNote: { marginTop: 7, fontSize: 9, lineHeight: 15, color: colors.muted, textAlign: 'center' },
  relatedCard: { marginBottom: 9 },
  relatedTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  relatedMeta: { fontSize: 10, color: colors.muted },
  relatedTitle: { marginTop: 9, fontSize: 14, lineHeight: 21, fontWeight: '700', color: colors.ink },
  relatedArrow: { marginTop: 8, fontSize: 11, fontWeight: '700', color: colors.brand },
  backButton: { marginTop: 14 },
  notFoundCard: { alignItems: 'center', paddingVertical: 28 },
  notFoundTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  notFoundBody: { marginTop: 8, fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center' },
  notFoundButton: { marginTop: 18, alignSelf: 'stretch' },
});
