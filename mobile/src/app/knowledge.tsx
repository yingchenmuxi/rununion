import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader, Card, DemoNote, Pill, PrimaryButton, Screen } from '@/components/qingrun-ui';
import { colors, radius, space } from '@/constants/qingrun';
import { useKnowledge } from '@/features/knowledge/KnowledgeContext';
import {
  FEATURED_ARTICLE,
  KNOWLEDGE_CATEGORIES,
  type KnowledgeArticle,
  type KnowledgeCategory,
} from '@/features/knowledge/knowledgeData';

const CATEGORY_TONE: Record<KnowledgeCategory, 'green' | 'gold' | 'coral' | 'neutral'> = {
  入门: 'green',
  呼吸: 'gold',
  配速: 'neutral',
  防伤: 'coral',
  营养: 'gold',
  恢复: 'green',
  比赛: 'coral',
  身体: 'neutral',
};

type FilterMode = 'all' | 'saved';

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable testID={'category-' + label} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ArticleCard({
  article,
  saved,
  onOpen,
  onToggleSaved,
}: {
  article: KnowledgeArticle;
  saved: boolean;
  onOpen: () => void;
  onToggleSaved: () => void;
}) {
  return (
    <Card style={styles.articleCard}>
      <View style={styles.articleTop}>
        <Pill text={article.category} tone={CATEGORY_TONE[article.category]} />
        <Pressable onPress={onToggleSaved} hitSlop={10}>
          <Text style={[styles.saveText, saved && styles.saveTextActive]}>
            {saved ? '已收藏' : '收藏'}
          </Text>
        </Pressable>
      </View>
      <Pressable testID={'knowledge-open-' + article.id} onPress={onOpen}>
        <Text style={styles.articleTitle}>{article.title}</Text>
        <Text style={styles.articleSummary} numberOfLines={2}>
          {article.summary}
        </Text>
        <View style={styles.articleFooter}>
          <Text style={styles.articleMeta}>
            {article.minutes} 分钟 · {article.level}
          </Text>
          <Text style={styles.readText}>阅读 ›</Text>
        </View>
      </Pressable>
    </Card>
  );
}

export default function KnowledgeScreen() {
  const router = useRouter();
  const { articles, savedIds, savedCount, isSaved, toggleSaved } = useKnowledge();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'全部' | KnowledgeCategory>('全部');
  const [mode, setMode] = useState<FilterMode>('all');

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      articles.filter((article) => {
        if (mode === 'saved' && !savedIds.includes(article.id)) return false;
        if (category !== '全部' && article.category !== category) return false;
        if (!normalizedQuery) return true;
        const haystack = (article.title + ' ' + article.summary + ' ' + article.category + ' ' + article.body.join(' ')).toLowerCase();
        return haystack.includes(normalizedQuery);
      }),
    [articles, category, mode, normalizedQuery, savedIds],
  );

  const showFeatured =
    mode === 'all' &&
    !normalizedQuery &&
    (category === '全部' || category === FEATURED_ARTICLE.category);
  const listArticles = showFeatured
    ? filtered.filter((article) => article.id !== FEATURED_ARTICLE.id)
    : filtered;

  const openArticle = (id: string) => router.push('/knowledge/' + id);

  const resetFilters = () => {
    setQuery('');
    setCategory('全部');
    setMode('all');
  };

  return (
    <Screen>
      <AppHeader
        title="跑步知识库"
        subtitle="先学会不受伤，再谈跑得快。"
        right={<Pill text={savedCount + ' 篇收藏'} tone="green" />}
      />

      <View style={styles.searchBox}>
        <Text style={styles.searchGlyph}>搜</Text>
        <TextInput
          testID="knowledge-search"
          value={query}
          onChangeText={setQuery}
          placeholder="搜：岔气、配速、膝盖、跑鞋…"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Text style={styles.clearText}>清空</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.modeRow}>
        <Pressable
          testID="knowledge-mode-all"
          onPress={() => setMode('all')}
          style={[styles.modeButton, mode === 'all' && styles.modeActive]}>
          <Text style={[styles.modeText, mode === 'all' && styles.modeTextActive]}>
            全部文章
          </Text>
        </Pressable>
        <Pressable
          testID="knowledge-mode-saved"
          onPress={() => setMode('saved')}
          style={[styles.modeButton, mode === 'saved' && styles.modeActive]}>
          <Text style={[styles.modeText, mode === 'saved' && styles.modeTextActive]}>
            我的收藏 {savedCount}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}>
        <CategoryChip label="全部" active={category === '全部'} onPress={() => setCategory('全部')} />
        {KNOWLEDGE_CATEGORIES.map((item) => (
          <CategoryChip
            key={item}
            label={item}
            active={category === item}
            onPress={() => setCategory(item)}
          />
        ))}
      </ScrollView>

      {showFeatured ? (
        <Card onPress={() => openArticle(FEATURED_ARTICLE.id)} style={styles.featured}>
          <View style={styles.featuredTop}>
            <Pill text="本周精选" tone="onDark" />
            <Text style={styles.featuredMinutes}>{FEATURED_ARTICLE.minutes} 分钟</Text>
          </View>
          <Text style={styles.featuredTitle}>{FEATURED_ARTICLE.title}</Text>
          <Text style={styles.featuredSummary}>{FEATURED_ARTICLE.summary}</Text>
          <View style={styles.featuredFooter}>
            <Text style={styles.featuredMeta}>
              {FEATURED_ARTICLE.category} · {FEATURED_ARTICLE.level}
            </Text>
            <Text style={styles.featuredLink}>开始阅读 ›</Text>
          </View>
        </Card>
      ) : null}

      <View style={styles.resultRow}>
        <Text style={styles.resultText}>
          {mode === 'saved' ? '我的收藏' : '主题文章'} · {filtered.length} 篇
        </Text>
        {category !== '全部' ? <Text style={styles.resultFilter}>{category}</Text> : null}
      </View>

      {listArticles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          saved={isSaved(article.id)}
          onOpen={() => openArticle(article.id)}
          onToggleSaved={() => toggleSaved(article.id)}
        />
      ))}

      {filtered.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {mode === 'saved' ? '还没有符合条件收藏' : '没有找到相关文章'}
          </Text>
          <Text style={styles.emptyBody}>
            {mode === 'saved'
              ? '先读几篇，点“收藏”就会出现在这里。'
              : '换一个关键词，或清空筛选看看全部主题。'}
          </Text>
          <PrimaryButton
            label={mode === 'saved' ? '去看全部文章' : '清空搜索和筛选'}
            variant="light"
            onPress={resetFilters}
            style={styles.emptyButton}
          />
        </Card>
      ) : null}

      {mode === 'all' && !normalizedQuery && category === '全部' ? (
        <View style={styles.noteRow}>
          <Text style={styles.noteKicker}>怎么用这个库</Text>
          <Text style={styles.noteText}>
            先按主题读，再把“今天就能做”的一条带进下一次跑步。身体不适时，先停跑，再查资料。
          </Text>
        </View>
      ) : null}

      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    marginTop: space.lg,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  searchGlyph: {
    width: 27,
    height: 27,
    borderRadius: 9,
    backgroundColor: colors.brandSoft,
    color: colors.brand,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 27,
    textAlign: 'center',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.ink,
  },
  clearText: { fontSize: 11, fontWeight: '700', color: colors.accent },
  modeRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: '#F1EDE4',
  },
  modeButton: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.pill },
  modeActive: { backgroundColor: colors.brand },
  modeText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  modeTextActive: { color: colors.white },
  chipRow: { gap: 7, paddingVertical: 14, paddingRight: 10 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  chipActive: { borderColor: colors.brand, backgroundColor: colors.brand },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.inkSoft },
  chipTextActive: { color: colors.white },
  featured: {
    marginTop: 2,
    backgroundColor: colors.brand,
    borderColor: colors.brand,
    padding: 18,
  },
  featuredTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredMinutes: { fontSize: 10, color: 'rgba(255,255,255,0.65)' },
  featuredTitle: {
    marginTop: 13,
    fontSize: 21,
    lineHeight: 29,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.2,
  },
  featuredSummary: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.75)',
  },
  featuredFooter: {
    marginTop: 15,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredMeta: { fontSize: 10, color: 'rgba(255,255,255,0.65)' },
  featuredLink: { fontSize: 12, fontWeight: '800', color: colors.white },
  resultRow: {
    marginTop: 18,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultText: { fontSize: 11, fontWeight: '700', color: colors.muted },
  resultFilter: { fontSize: 10, fontWeight: '700', color: colors.brand },
  articleCard: { marginBottom: 10 },
  articleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  saveText: { fontSize: 11, fontWeight: '700', color: colors.muted },
  saveTextActive: { color: colors.gold },
  articleTitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
    color: colors.ink,
  },
  articleSummary: { marginTop: 5, fontSize: 12, lineHeight: 18, color: colors.muted },
  articleFooter: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  articleMeta: { fontSize: 10, color: colors.muted },
  readText: { fontSize: 11, fontWeight: '700', color: colors.brand },
  emptyCard: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 18 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  emptyBody: {
    marginTop: 7,
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
    textAlign: 'center',
  },
  emptyButton: { marginTop: 14, alignSelf: 'stretch' },
  noteRow: {
    marginTop: 8,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: '#F1EDE4',
  },
  noteKicker: { fontSize: 11, fontWeight: '800', color: colors.brand },
  noteText: { marginTop: 5, fontSize: 11, lineHeight: 18, color: colors.inkSoft },
});
