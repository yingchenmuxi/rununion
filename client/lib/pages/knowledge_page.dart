// ============================================================
// 模块一：跑步知识普及页（升级版）
// 功能：
//   - 顶部搜索框：模糊搜索标题/摘要/内容/标签
//   - 分类筛选条：一键切换分类
//   - 文章卡片：封面图 + 标题 + 摘要 + 标签 + 阅读时长
//   - 点击卡片进入全屏详情页（支持附件跳转）
//   - 管理员可发布 / 删除文章
// ============================================================
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../models.dart';
import 'article_detail_page.dart';

class KnowledgePage extends StatefulWidget {
  final String token;
  final User user;

  const KnowledgePage({super.key, required this.token, required this.user});

  @override
  State<KnowledgePage> createState() => _KnowledgePageState();
}

class _KnowledgePageState extends State<KnowledgePage> {
  List<Article>? _articles;
  List<String> _categories = ['全部'];
  String? _error;
  String _selectedCategory = '全部';

  // 搜索相关
  final _searchCtrl = TextEditingController();
  Timer? _debounce; // 防抖：用户停止输入 500ms 后才真正发请求
  bool _searching = false;

  @override
  void initState() {
    super.initState();
    _loadCategories();
    _loadArticles();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  // 拉一次分类列表（筛选条用）
  Future<void> _loadCategories() async {
    try {
      final list = await Api.listArticleCategories(widget.token);
      if (!mounted) return;
      setState(() => _categories = ['全部', ...list]);
    } catch (_) {
      // 分类加载失败不阻塞主流程，保留默认即可
    }
  }

  // 拉文章列表（带当前搜索词和分类）
  Future<void> _loadArticles() async {
    setState(() {
      _error = null;
      _searching = true;
    });
    try {
      final res = await Api.listArticles(
        widget.token,
        q: _searchCtrl.text.trim(),
        category: _selectedCategory,
      );
      if (!mounted) return;
      setState(() {
        _articles = res.list;
        _searching = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _articles = [];
        _searching = false;
      });
    }
  }

  // 搜索框输入变化时：防抖 500ms 再发请求
  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), _loadArticles);
  }

  // 清空搜索
  void _clearSearch() {
    _searchCtrl.clear();
    _debounce?.cancel();
    _loadArticles();
  }

  // 打开"发布文章"对话框（管理员）
  // 支持：选封面图（手机相册）/ 正文插入图片 / 附件URL
  Future<void> _showAddDialog() async {
    final categoryCtrl = TextEditingController(text: '跑前准备');
    final titleCtrl = TextEditingController();
    final summaryCtrl = TextEditingController();
    final contentCtrl = TextEditingController();
    final tagsCtrl = TextEditingController();
    final attachmentCtrl = TextEditingController();
    // 封面图本地上传后的 URL（/uploads/xxx.jpg）
    String coverUrl = '';
    bool uploading = false;

    final picker = ImagePicker();

    // 选图 + 上传到后端，返回 /uploads/xxx
    Future<String?> pickAndUpload() async {
      try {
        final picked = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1600);
        if (picked == null) return null;
        final bytes = await picked.readAsBytes();
        final mime = picked.name.toLowerCase().endsWith('.png')
            ? 'image/png'
            : picked.name.toLowerCase().endsWith('.gif')
                ? 'image/gif'
                : picked.name.toLowerCase().endsWith('.webp')
                    ? 'image/webp'
                    : 'image/jpeg';
        final dataUrl = 'data:$mime;base64,${base64Encode(bytes)}';
        return await Api.uploadFile(widget.token, dataUrl);
      } on ApiException catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
        }
        return null;
      }
    }

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: const Text('发布知识文章'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: categoryCtrl,
                  decoration: const InputDecoration(
                    labelText: '分类',
                    hintText: '跑前准备 / 动作标准 / 伤病预防 / 训练计划 / 装备选择 / 营养恢复',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: titleCtrl,
                  decoration: const InputDecoration(labelText: '标题', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: summaryCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: '摘要（列表卡片显示）',
                    border: OutlineInputBorder(),
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 12),
                // 正文编辑区 + 插图按钮
                TextField(
                  controller: contentCtrl,
                  maxLines: 8,
                  decoration: const InputDecoration(
                    labelText: '正文',
                    border: OutlineInputBorder(),
                    alignLabelWithHint: true,
                    helperText: '在正文中用 [img:图片URL] 插入图片',
                  ),
                ),
                const SizedBox(height: 8),
                // 正文插图按钮
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    icon: uploading
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.image_outlined),
                    label: Text(uploading ? '上传中...' : '插入图片到正文末尾'),
                    onPressed: uploading
                        ? null
                        : () async {
                            setDlg(() => uploading = true);
                            final url = await pickAndUpload();
                            setDlg(() => uploading = false);
                            if (url != null) {
                              contentCtrl.text = '${contentCtrl.text}\n\n[img:$url]\n';
                            }
                          },
                  ),
                ),
                const SizedBox(height: 12),
                // 封面图选择
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.photo_size_select_actual_outlined, size: 18),
                          const SizedBox(width: 6),
                          const Text('封面图', style: TextStyle(fontWeight: FontWeight.bold)),
                          const Spacer(),
                          TextButton.icon(
                            icon: const Icon(Icons.upload, size: 16),
                            label: Text(coverUrl.isEmpty ? '从相册选图' : '重新选择'),
                            onPressed: () async {
                              setDlg(() => uploading = true);
                              final url = await pickAndUpload();
                              setDlg(() {
                                uploading = false;
                                if (url != null) coverUrl = url;
                              });
                            },
                          ),
                        ],
                      ),
                      if (coverUrl.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: Image.network(
                            Api.fullUrl(coverUrl),
                            height: 120,
                            width: double.infinity,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ] else
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            '未选择 · 不选则显示默认背景',
                            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: tagsCtrl,
                  decoration: const InputDecoration(
                    labelText: '标签（可选，逗号分隔）',
                    hintText: '例如：新手,姿势,热身',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: attachmentCtrl,
                  decoration: const InputDecoration(
                    labelText: '附件 URL（可选，PDF/文档链接）',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
            FilledButton(
              onPressed: uploading ? null : () => Navigator.pop(ctx, true),
              child: const Text('发布'),
            ),
          ],
        ),
      ),
    );
    if (ok != true) return;

    try {
      await Api.addArticle(
        widget.token,
        category: categoryCtrl.text.trim(),
        title: titleCtrl.text.trim(),
        summary: summaryCtrl.text.trim(),
        content: contentCtrl.text.trim(),
        tags: tagsCtrl.text.trim(),
        imageUrl: coverUrl,
        attachmentUrl: attachmentCtrl.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('发布成功')));
      _loadCategories();
      _loadArticles();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  // 删除文章（管理员）
  Future<void> _delete(Article a) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除文章'),
        content: Text('确定要删除《${a.title}》吗？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      await Api.deleteArticle(widget.token, a.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('已删除')));
      _loadCategories();
      _loadArticles();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  // 跳转到详情页
  void _openDetail(Article a) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ArticleDetailPage(article: a)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          // ===== 顶部搜索框 =====
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: TextField(
              controller: _searchCtrl,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: '搜索标题 / 内容 / 标签...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchCtrl.text.isNotEmpty
                    ? IconButton(icon: const Icon(Icons.clear), onPressed: _clearSearch)
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                ),
                filled: true,
                fillColor: Colors.grey.shade100,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
              ),
            ),
          ),
          // ===== 分类筛选条 =====
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                for (final cat in _categories)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(cat),
                      selected: _selectedCategory == cat,
                      onSelected: (_) {
                        setState(() => _selectedCategory = cat);
                        _loadArticles();
                      },
                      selectedColor: Colors.green.shade100,
                      labelStyle: TextStyle(
                        color: _selectedCategory == cat ? Colors.green.shade900 : Colors.black87,
                        fontWeight: _selectedCategory == cat ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          const Divider(height: 1),
          // ===== 文章列表 =====
          Expanded(child: _buildBody()),
        ],
      ),
      floatingActionButton: widget.user.isAdmin
          ? FloatingActionButton(
              onPressed: _showAddDialog,
              child: const Icon(Icons.add),
            )
          : null,
    );
  }

  Widget _buildBody() {
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.cloud_off, size: 60, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: _loadArticles, child: const Text('重试')),
          ],
        ),
      );
    }
    if (_articles == null && _searching) {
      return const Center(child: CircularProgressIndicator());
    }
    final list = _articles ?? [];
    if (list.isEmpty) {
      final hint = _searchCtrl.text.isNotEmpty
          ? '没有找到匹配"${_searchCtrl.text}"的文章'
          : (_selectedCategory == '全部' ? '还没有文章' : '"$_selectedCategory"分类下没有文章');
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.menu_book_outlined, size: 60, color: Colors.grey.shade300),
            const SizedBox(height: 12),
            Text(hint, style: TextStyle(color: Colors.grey.shade600)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadArticles,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 80),
        itemCount: list.length,
        itemBuilder: (context, i) => _buildCard(list[i]),
      ),
    );
  }

  // 单张文章卡片
  Widget _buildCard(Article a) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      elevation: 1,
      child: InkWell(
        onTap: () => _openDetail(a),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 封面图（有就显示）
            if (a.imageUrl.isNotEmpty)
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Image.network(
                  Api.fullUrl(a.imageUrl),
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Colors.green.shade300, Colors.green.shade600],
                      ),
                    ),
                    child: const Center(
                      child: Icon(Icons.directions_run, size: 60, color: Colors.white70),
                    ),
                  ),
                  loadingBuilder: (context, child, progress) {
                    if (progress == null) return child;
                    return Container(
                      color: Colors.grey.shade200,
                      child: const Center(child: CircularProgressIndicator()),
                    );
                  },
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 分类 + 阅读时长
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.green.shade50,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          a.category,
                          style: TextStyle(
                            color: Colors.green.shade700,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(Icons.schedule, size: 12, color: Colors.grey.shade500),
                      const SizedBox(width: 2),
                      Text(
                        '${a.readingMinutes} 分钟',
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 11),
                      ),
                      const Spacer(),
                      // 管理员显示删除按钮
                      if (widget.user.isAdmin)
                        InkWell(
                          onTap: () => _delete(a),
                          borderRadius: BorderRadius.circular(16),
                          child: const Padding(
                            padding: EdgeInsets.all(4),
                            child: Icon(Icons.delete_outline, size: 18, color: Colors.red),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  // 标题
                  Text(
                    a.title,
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, height: 1.3),
                  ),
                  const SizedBox(height: 6),
                  // 摘要
                  if (a.summary.isNotEmpty)
                    Text(
                      a.summary,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Colors.grey.shade700, fontSize: 13, height: 1.4),
                    ),
                  // 标签
                  if (a.tagList.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        for (final tag in a.tagList.take(4))
                          Text(
                            '#$tag',
                            style: TextStyle(color: Colors.green.shade600, fontSize: 11),
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
