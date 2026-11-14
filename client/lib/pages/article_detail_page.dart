// ============================================================
// 文章详情页：全屏沉浸式阅读
// 包含：封面图 / 标题 / 分类标签 / 阅读时长 / 富文本正文 / 附件下载入口
// 正文支持 [img:url] 标记，会被解析成图片组件嵌入到文本流中
// ============================================================
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../models.dart';

class ArticleDetailPage extends StatelessWidget {
  final Article article;

  const ArticleDetailPage({super.key, required this.article});

  // 打开附件链接（用系统浏览器）
  Future<void> _openAttachment(BuildContext context) async {
    if (article.attachmentUrl.isEmpty) return;
    final uri = Uri.tryParse(article.attachmentUrl);
    if (uri == null) return;
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('无法打开附件链接')),
        );
      }
    }
  }

  // 把正文按 [img:url] 标记切分成 文本/图片 两种块
  // 例如 "段落一\n[img:/uploads/a.jpg]\n段落二" → [text, image, text]
  List<_ContentBlock> _parseContent(String content) {
    final blocks = <_ContentBlock>[];
    final reg = RegExp(r'\[img:([^\]]+)\]');
    int last = 0;
    for (final m in reg.allMatches(content)) {
      // 图片前的文本
      if (m.start > last) {
        final text = content.substring(last, m.start).trim();
        if (text.isNotEmpty) blocks.add(_ContentBlock.text(text));
      }
      blocks.add(_ContentBlock.image(m.group(1)!));
      last = m.end;
    }
    // 剩余文本
    if (last < content.length) {
      final text = content.substring(last).trim();
      if (text.isNotEmpty) blocks.add(_ContentBlock.text(text));
    }
    return blocks;
  }

  @override
  Widget build(BuildContext context) {
    final blocks = _parseContent(article.content);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // 顶部可伸缩的封面图（带返回按钮）
          SliverAppBar(
            expandedHeight: article.imageUrl.isNotEmpty ? 220 : 0,
            pinned: true,
            flexibleSpace: article.imageUrl.isNotEmpty
                ? FlexibleSpaceBar(
                    background: Image.network(
                      Api.fullUrl(article.imageUrl),
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [Colors.green.shade400, Colors.green.shade700],
                          ),
                        ),
                        child: const Center(
                          child: Icon(Icons.directions_run, size: 80, color: Colors.white70),
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
                  )
                : null,
          ),
          // 正文内容
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 分类 + 阅读时长
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.green.shade50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.green.shade200),
                        ),
                        child: Text(
                          article.category,
                          style: TextStyle(
                            color: Colors.green.shade700,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Icon(Icons.schedule, size: 14, color: Colors.grey.shade500),
                      const SizedBox(width: 4),
                      Text(
                        '约 ${article.readingMinutes} 分钟',
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // 标题
                  Text(
                    article.title,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 12),
                  // 摘要
                  if (article.summary.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(8),
                        border: Border(
                          left: BorderSide(color: Colors.green.shade400, width: 4),
                        ),
                      ),
                      child: Text(
                        article.summary,
                        style: TextStyle(
                          color: Colors.grey.shade800,
                          fontSize: 14,
                          height: 1.5,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  // 富文本正文：文本段落 + 内嵌图片
                  for (final block in blocks) ...[
                    if (block.isText)
                      Text(
                        block.text!,
                        style: const TextStyle(
                          fontSize: 16,
                          height: 1.8,
                          letterSpacing: 0.3,
                        ),
                      )
                    else
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.network(
                            Api.fullUrl(block.imageUrl!),
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              height: 160,
                              color: Colors.grey.shade200,
                              child: const Center(
                                child: Icon(Icons.broken_image_outlined, size: 40, color: Colors.grey),
                              ),
                            ),
                            loadingBuilder: (context, child, progress) {
                              if (progress == null) return child;
                              return Container(
                                height: 160,
                                color: Colors.grey.shade100,
                                child: const Center(child: CircularProgressIndicator()),
                              );
                            },
                          ),
                        ),
                      ),
                  ],
                  const SizedBox(height: 24),
                  // 标签
                  if (article.tagList.isNotEmpty) ...[
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final tag in article.tagList)
                          Chip(
                            label: Text('# $tag', style: const TextStyle(fontSize: 12)),
                            backgroundColor: Colors.grey.shade100,
                            padding: EdgeInsets.zero,
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],
                  // 附件下载按钮
                  if (article.attachmentUrl.isNotEmpty) ...[
                    Card(
                      color: Colors.blue.shade50,
                      child: ListTile(
                        leading: const Icon(Icons.attach_file, color: Colors.blue),
                        title: const Text('查看附件资料'),
                        subtitle: const Text('在浏览器中打开', style: TextStyle(fontSize: 12)),
                        trailing: const Icon(Icons.open_in_new, size: 18),
                        onTap: () => _openAttachment(context),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// 内容块：要么是文本，要么是图片
class _ContentBlock {
  final String? text;
  final String? imageUrl;

  _ContentBlock.text(this.text) : imageUrl = null;
  _ContentBlock.image(this.imageUrl) : text = null;

  bool get isText => text != null;
}
