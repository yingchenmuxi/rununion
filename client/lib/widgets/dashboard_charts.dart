// ============================================================
// 数据看板自绘图表组件（N10）
// 项目不引入第三方图表库，全部用 CustomPainter 自绘，
// 与个人中心曲线图（profile_page.dart）风格保持一致。
// 包含：折线图、柱状图、横向条形图、饼图
// ============================================================
import 'dart:math' as math;

import 'package:flutter/material.dart';

// ------------------------------------------------------------
// 折线图：用于"近 30 天新增用户 / 活跃用户"趋势
// values 为数值序列，dates 为对应的日期标签（YYYY-MM-DD）
// ------------------------------------------------------------
class DashboardLineChart extends StatelessWidget {
  final List<double> values;
  final List<String> dates;
  final Color color;

  const DashboardLineChart({
    super.key,
    required this.values,
    required this.dates,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    if (values.length < 2) {
      return _emptyHint('暂无足够数据');
    }
    return SizedBox(
      height: 160,
      child: CustomPaint(
        painter: _LineChartPainter(values, dates, color),
        child: Container(),
      ),
    );
  }
}

class _LineChartPainter extends CustomPainter {
  final List<double> values;
  final List<String> dates;
  final Color color;

  _LineChartPainter(this.values, this.dates, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    // 左侧留 28px 画 Y 轴刻度，底部留 18px 画日期标签
    const leftPad = 28.0;
    const bottomPad = 18.0;
    final chartW = size.width - leftPad;
    final chartH = size.height - bottomPad;

    final maxV = values.reduce(math.max);
    final yMax = maxV <= 0 ? 1.0 : maxV * 1.15; // 顶部留 15% 边距

    final gridPaint = Paint()
      ..color = Colors.grey.shade200
      ..strokeWidth = 1;
    final linePaint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke
      ..strokeJoin = StrokeJoin.round;
    final dotPaint = Paint()..color = color;
    final textStyle = TextStyle(fontSize: 9, color: Colors.grey.shade600);

    // 横向网格线 + Y 轴刻度（4 条）
    for (int i = 0; i <= 4; i++) {
      final y = chartH * i / 4;
      canvas.drawLine(Offset(leftPad, y), Offset(size.width, y), gridPaint);
      final label = (yMax * (4 - i) / 4).toInt().toString();
      final tp = TextPainter(
        text: TextSpan(text: label, style: textStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(leftPad - tp.width - 4, y - tp.height / 2));
    }

    // 计算折线点
    final points = <Offset>[];
    for (int i = 0; i < values.length; i++) {
      final x = leftPad + chartW * i / (values.length - 1);
      final y = chartH * (1 - values[i] / yMax);
      points.add(Offset(x, y));
    }
    final path = Path()..moveTo(points[0].dx, points[0].dy);
    for (int i = 1; i < points.length; i++) {
      path.lineTo(points[i].dx, points[i].dy);
    }
    canvas.drawPath(path, linePaint);
    for (final p in points) {
      canvas.drawCircle(p, 2.5, dotPaint);
    }

    // X 轴日期标签：30 个点全画会挤在一起，只画首/中/尾 3 个（MM-DD）
    final labelIdx = <int>{0, values.length ~/ 2, values.length - 1};
    for (final i in labelIdx) {
      if (i >= dates.length) continue;
      final label = dates[i].length >= 10 ? dates[i].substring(5) : dates[i];
      final tp = TextPainter(
        text: TextSpan(text: label, style: textStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      var x = points[i].dx - tp.width / 2;
      if (i == 0) x = leftPad;
      if (i == values.length - 1) x = size.width - tp.width;
      tp.paint(canvas, Offset(x, chartH + 4));
    }
  }

  @override
  bool shouldRepaint(covariant _LineChartPainter old) =>
      old.values != values || old.color != color;
}

// ------------------------------------------------------------
// 柱状图：用于"近 12 周跑量"趋势
// ------------------------------------------------------------
class DashboardBarChart extends StatelessWidget {
  final List<double> values;
  final List<String> labels; // 每周一日期
  final Color color;

  const DashboardBarChart({
    super.key,
    required this.values,
    required this.labels,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    if (values.isEmpty) {
      return _emptyHint('暂无数据');
    }
    return SizedBox(
      height: 160,
      child: CustomPaint(
        painter: _BarChartPainter(values, labels, color),
        child: Container(),
      ),
    );
  }
}

class _BarChartPainter extends CustomPainter {
  final List<double> values;
  final List<String> labels;
  final Color color;

  _BarChartPainter(this.values, this.labels, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    const leftPad = 34.0;
    const bottomPad = 18.0;
    final chartW = size.width - leftPad;
    final chartH = size.height - bottomPad;

    final maxV = values.reduce(math.max);
    final yMax = maxV <= 0 ? 1.0 : maxV * 1.15;

    final gridPaint = Paint()
      ..color = Colors.grey.shade200
      ..strokeWidth = 1;
    final barPaint = Paint()..color = color;
    final textStyle = TextStyle(fontSize: 9, color: Colors.grey.shade600);

    // 网格线 + Y 轴刻度
    for (int i = 0; i <= 4; i++) {
      final y = chartH * i / 4;
      canvas.drawLine(Offset(leftPad, y), Offset(size.width, y), gridPaint);
      final label = (yMax * (4 - i) / 4).toInt().toString();
      final tp = TextPainter(
        text: TextSpan(text: label, style: textStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(leftPad - tp.width - 4, y - tp.height / 2));
    }

    // 画柱子：柱宽 = 槽宽的 60%，居中
    final slotW = chartW / values.length;
    final barW = slotW * 0.6;
    for (int i = 0; i < values.length; i++) {
      final h = chartH * (values[i] / yMax);
      final x = leftPad + slotW * i + (slotW - barW) / 2;
      final rect = Rect.fromLTWH(x, chartH - h, barW, h);
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, const Radius.circular(2)),
        barPaint,
      );
    }

    // X 轴标签：12 周全画太挤，隔 3 个画一个（MM-DD）
    for (int i = 0; i < labels.length; i += 3) {
      final label = labels[i].length >= 10 ? labels[i].substring(5) : labels[i];
      final tp = TextPainter(
        text: TextSpan(text: label, style: textStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      final x = leftPad + slotW * i + slotW / 2 - tp.width / 2;
      tp.paint(canvas, Offset(x, chartH + 4));
    }
  }

  @override
  bool shouldRepaint(covariant _BarChartPainter old) =>
      old.values != values || old.color != color;
}

// ------------------------------------------------------------
// 横向条形图：用于"社团跑量 TOP10"对比
// 每行：社团名（学校） + 条形 + 数值
// ------------------------------------------------------------
class DashboardClubBarList extends StatelessWidget {
  final List<String> names;   // 展示名（社团名 · 学校名）
  final List<double> values;  // 总跑量
  final List<String> tail;    // 行尾附加信息（成员数）

  const DashboardClubBarList({
    super.key,
    required this.names,
    required this.values,
    required this.tail,
  });

  @override
  Widget build(BuildContext context) {
    if (values.isEmpty) {
      return _emptyHint('暂无社团数据');
    }
    final maxV = values.reduce(math.max);
    return Column(
      children: [
        for (int i = 0; i < values.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                // 左侧：排名 + 社团名（定宽省略）
                SizedBox(
                  width: 18,
                  child: Text('${i + 1}',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: i < 3 ? Colors.orange : Colors.grey)),
                ),
                Expanded(
                  flex: 4,
                  child: Text(
                    names[i],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
                // 中间：条形
                Expanded(
                  flex: 5,
                  child: Stack(
                    children: [
                      Container(
                        height: 14,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade200,
                          borderRadius: BorderRadius.circular(7),
                        ),
                      ),
                      FractionallySizedBox(
                        widthFactor: maxV <= 0 ? 0 : values[i] / maxV,
                        child: Container(
                          height: 14,
                          decoration: BoxDecoration(
                            color: i < 3 ? Colors.orange : Colors.teal,
                            borderRadius: BorderRadius.circular(7),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                // 右侧：数值 + 成员数
                SizedBox(
                  width: 92,
                  child: Text(
                    '${values[i].toStringAsFixed(1)}km/${tail[i]}人',
                    textAlign: TextAlign.right,
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

// ------------------------------------------------------------
// 饼图：用于"角色分布 / 计划状态分布"
// 左边饼图，右边图例
// ------------------------------------------------------------
class DashboardPieChart extends StatelessWidget {
  final List<String> labels;
  final List<int> counts;
  final List<Color> colors;

  const DashboardPieChart({
    super.key,
    required this.labels,
    required this.counts,
    required this.colors,
  });

  @override
  Widget build(BuildContext context) {
    final total = counts.fold<int>(0, (s, c) => s + c);
    if (total <= 0) {
      return _emptyHint('暂无数据');
    }
    return SizedBox(
      height: 130,
      child: Row(
        children: [
          SizedBox(
            width: 110,
            height: 110,
            child: CustomPaint(
              painter: _PieChartPainter(counts, colors),
              child: Container(),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (int i = 0; i < labels.length; i++)
                  if (counts[i] > 0)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(
                        children: [
                          Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                              color: colors[i % colors.length],
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              '${labels[i]}  ${counts[i]}（${(counts[i] / total * 100).toStringAsFixed(0)}%）',
                              style: const TextStyle(fontSize: 12),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PieChartPainter extends CustomPainter {
  final List<int> counts;
  final List<Color> colors;

  _PieChartPainter(this.counts, this.colors);

  @override
  void paint(Canvas canvas, Size size) {
    final total = counts.fold<int>(0, (s, c) => s + c);
    if (total <= 0) return;
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2;
    var startAngle = -math.pi / 2; // 从顶部开始
    for (int i = 0; i < counts.length; i++) {
      if (counts[i] <= 0) continue;
      final sweep = counts[i] / total * 2 * math.pi;
      final paint = Paint()..color = colors[i % colors.length];
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        sweep,
        true,
        paint,
      );
      startAngle += sweep;
    }
    // 中间挖个白洞，变成环形图（更现代）
    canvas.drawCircle(center, radius * 0.45, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant _PieChartPainter old) => old.counts != counts;
}

// 通用空数据占位
Widget _emptyHint(String text) {
  return SizedBox(
    height: 120,
    child: Center(
      child: Text(text, style: TextStyle(fontSize: 13, color: Colors.grey.shade500)),
    ),
  );
}
