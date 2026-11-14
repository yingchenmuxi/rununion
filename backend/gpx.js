// ============================================================
// GPX 导入模块：解析华为/小米/Keep 等 App 导出的 GPX 文件
// 使用方式：
//   POST /api/import/gpx
//   Body: { "gpx": "<?xml version=..." }  （GPX 文件内容，文本）
//   返回: {
//     "distanceKm": 9.98,        // 距离（公里）
//     "durationSeconds": 3341,   // 用时（秒）
//     "paceSecondsPerKm": 334,   // 平均配速（秒/公里）
//     "heartRate": 153,          // 平均心率（有则返回）
//     "cadence": 165,            // 平均步频（有则返回）
//     "strideLength": 103,       // 平均步幅（有则返回）
//     "date": "2026-10-01"       // 跑步日期
//   }
// 设计要点：
//   - GPX 是标准格式，华为/小米/Keep 都能导出，一套解析通用
//   - 数据 100% 准，不会像截图识别那样出错
//   - 只提取跑步相关数据，忽略轨迹点详情
// ============================================================
const express = require('express');
const { XMLParser } = require('fast-xml-parser');
const { authRequired } = require('./auth');

const router = express.Router();

// GPX 文件最大 5 MB
const MAX_SIZE = 5 * 1024 * 1024;

// 导入 GPX 文件（单独挂 authRequired，不再全局拦截）
router.post('/import/gpx', authRequired, (req, res) => {
  const { gpx } = req.body || {};
  if (!gpx || typeof gpx !== 'string') {
    return res.status(400).json({ error: '缺少 gpx 字段（GPX 文件内容）' });
  }
  if (gpx.length > MAX_SIZE) {
    return res.status(400).json({ error: `GPX 文件过大，最大支持 ${MAX_SIZE / 1024 / 1024} MB` });
  }

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
    const doc = parser.parse(gpx);

    // GPX 结构：<gpx><trk><trkseg><trkpt lat=".." lon=".."><ele>..</ele><time>..</time><extensions><hr>153</hr><cad>165</cad></extensions></trkpt>...</trkseg></trk></gpx>
    const trk = doc?.gpx?.trk;
    if (!trk) {
      return res.status(400).json({ error: 'GPX 文件中没有找到轨迹数据' });
    }

    // 收集所有轨迹点
    const trksegs = Array.isArray(trk.trkseg) ? trk.trkseg : [trk.trkseg];
    const points = [];
    for (const seg of trksegs) {
      const trkpts = Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt];
      for (const pt of trkpts) {
        if (pt && pt['@_lat'] && pt['@_lon']) {
          points.push(pt);
        }
      }
    }

    if (points.length === 0) {
      return res.status(400).json({ error: 'GPX 文件中没有有效的轨迹点' });
    }

    // 1) 计算距离：相邻轨迹点距离累加（Haversine 公式）
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      const lat1 = parseFloat(points[i - 1]['@_lat']);
      const lon1 = parseFloat(points[i - 1]['@_lon']);
      const lat2 = parseFloat(points[i]['@_lat']);
      const lon2 = parseFloat(points[i]['@_lon']);
      totalDistance += haversine(lat1, lon1, lat2, lon2);
    }
    const distanceKm = totalDistance / 1000;

    // 2) 计算用时：最后一个点时间 - 第一个点时间
    const firstTime = points[0].time;
    const lastTime = points[points.length - 1].time;
    let durationSeconds = 0;
    if (firstTime && lastTime) {
      const t1 = new Date(firstTime).getTime();
      const t2 = new Date(lastTime).getTime();
      durationSeconds = Math.round((t2 - t1) / 1000);
    }

    // 3) 计算平均配速
    let paceSecondsPerKm = null;
    if (durationSeconds > 0 && distanceKm > 0) {
      paceSecondsPerKm = Math.round(durationSeconds / distanceKm);
    }

    // 4) 提取心率、步频、步幅（从 extensions 里）
    let heartRateSum = 0, heartRateCount = 0;
    let cadenceSum = 0, cadenceCount = 0;
    let strideLengthSum = 0, strideLengthCount = 0;

    for (const pt of points) {
      const ext = pt.extensions;
      if (!ext) continue;
      // 心率：<hr>153</hr> 或 <gpxtpx:hr>153</gpxtpx:hr>
      const hr = ext.hr || ext['gpxtpx:hr'] || ext['ns3:hr'];
      if (hr) {
        heartRateSum += parseInt(hr, 10);
        heartRateCount++;
      }
      // 步频：<cad>165</cad> 或 <gpxtpx:cad>165</gpxtpx:cad>
      const cad = ext.cad || ext['gpxtpx:cad'] || ext['ns3:cad'];
      if (cad) {
        cadenceSum += parseInt(cad, 10);
        cadenceCount++;
      }
      // 步幅：<stride>103</stride>（小米/华为可能用不同标签）
      const stride = ext.stride || ext['gpxtpx:stride'] || ext['ns3:stride'];
      if (stride) {
        strideLengthSum += parseFloat(stride);
        strideLengthCount++;
      }
    }

    const heartRate = heartRateCount > 0 ? Math.round(heartRateSum / heartRateCount) : null;
    const cadence = cadenceCount > 0 ? Math.round(cadenceSum / cadenceCount) : null;
    const strideLength = strideLengthCount > 0 ? Math.round(strideLengthSum / strideLengthCount) : null;

    // 5) 提取日期
    let date = null;
    if (firstTime) {
      date = new Date(firstTime).toISOString().split('T')[0];
    }

    res.json({
      distanceKm: Math.round(distanceKm * 100) / 100, // 保留两位小数
      durationSeconds,
      paceSecondsPerKm,
      heartRate,
      cadence,
      strideLength,
      date,
      pointsCount: points.length, // 调试用：轨迹点数量
    });
  } catch (e) {
    console.error('GPX 解析失败：', e);
    res.status(500).json({ error: 'GPX 文件解析失败，请确认文件格式正确' });
  }
});

// Haversine 公式：计算两个经纬度点之间的距离（米）
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半径（米）
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

module.exports = router;
