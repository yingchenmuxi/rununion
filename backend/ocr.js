// ============================================================
// 截图识别模块：识别 Keep 等跑步 App 的运动记录截图，提取距离/用时/配速
// 使用方式：
//   POST /api/ocr/keep-run
//   Body: { "image": "data:image/jpeg;base64,xxxxx" }
//   返回: {
//     "rawText": "识别到的全部文字（调试用）",
//     "distanceKm": 5.2,        // 跑步距离（公里），null=没识别到
//     "durationSeconds": 1830,  // 总用时（秒），null=没识别到
//     "paceSecondsPerKm": 352,  // 配速（秒/公里），null=没识别到
//     "date": "2026-10-20"      // 跑步日期，null=没识别到
//   }
// 设计要点：
//   - 用 tesseract.js 在后端做 OCR，网页版和安卓客户端共用一套逻辑
//   - 识别结果只用来"预填"表单，用户确认后才提交，识别错了不污染数据
//   - 语言包用 eng（英文+数字），Keep 截图主要是阿拉伯数字，识别快且准
// ============================================================
const express = require('express');
const { createWorker } = require('tesseract.js');
const { authRequired } = require('./auth');

const router = express.Router();

// 单张截图最大 10 MB
const MAX_SIZE = 10 * 1024 * 1024;

// OCR worker 懒加载：首次请求时初始化，之后复用，避免每次都重新加载语言包
let workerPromise = null;
function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      // 1) 识别英文+数字（Keep 截图主要是数字，中文标签识别不准也没关系，我们靠数字位置判断）
      // 2) 限制字符集为数字和常见符号，提高数字识别准确率
      const w = await createWorker('eng');
      await w.setParameters({
        tessedit_char_whitelist: '0123456789:.\' ', // 数字、冒号、点、分号、空格
      });
      return w;
    })();
  }
  return workerPromise;
}

// 识别 Keep 跑步记录截图（单独挂 authRequired，不再全局拦截）
router.post('/ocr/keep-run', authRequired, async (req, res) => {
  const { image } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: '缺少 image 字段（base64 编码）' });
  }

  // 解析 "data:image/jpeg;base64,xxxxxx"
  const match = image.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'image 格式不正确，应为 data:<mime>;base64,<内容>' });
  }
  const mime = match[1].toLowerCase();
  if (!mime.startsWith('image/')) {
    return res.status(400).json({ error: '只支持图片格式' });
  }
  const base64Body = match[2];

  let buffer;
  try {
    buffer = Buffer.from(base64Body, 'base64');
  } catch (e) {
    return res.status(400).json({ error: 'base64 解码失败' });
  }
  if (buffer.length === 0) {
    return res.status(400).json({ error: '图片内容为空' });
  }
  if (buffer.length > MAX_SIZE) {
    return res.status(400).json({ error: `图片过大，最大支持 ${MAX_SIZE / 1024 / 1024} MB` });
  }

  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(buffer);
    const rawText = data.text || '';
    // 把识别到的文字交给解析函数（根据 Keep 真实截图版式写的）
    const parsed = parseKeepScreenshot(rawText);
    res.json({ rawText, ...parsed });
  } catch (e) {
    console.error('OCR 识别失败：', e);
    res.status(500).json({ error: '识别失败，请重试或手动填写' });
  }
});

// 识别 Keep 详细数据截图（心率/触地时间/垂直振幅/步幅/步频）
// 对应 Keep 跑步记录里的「手表数据」或「跑姿分析」页面
router.post('/ocr/keep-detail', authRequired, async (req, res) => {
  const { image } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: '缺少 image 字段（base64 编码）' });
  }

  const match = image.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'image 格式不正确，应为 data:<mime>;base64,<内容>' });
  }
  const mime = match[1].toLowerCase();
  if (!mime.startsWith('image/')) {
    return res.status(400).json({ error: '只支持图片格式' });
  }
  const base64Body = match[2];

  let buffer;
  try {
    buffer = Buffer.from(base64Body, 'base64');
  } catch (e) {
    return res.status(400).json({ error: 'base64 解码失败' });
  }
  if (buffer.length === 0) {
    return res.status(400).json({ error: '图片内容为空' });
  }
  if (buffer.length > MAX_SIZE) {
    return res.status(400).json({ error: `图片过大，最大支持 ${MAX_SIZE / 1024 / 1024} MB` });
  }

  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(buffer);
    const rawText = data.text || '';
    const parsed = parseKeepDetailScreenshot(rawText);
    res.json({ rawText, ...parsed });
  } catch (e) {
    console.error('OCR 详细数据识别失败：', e);
    res.status(500).json({ error: '识别失败，请重试或手动填写' });
  }
});

// ------------------------------------------------------------
// 解析 Keep 截图识别出的文字，提取距离/用时/配速/日期
// 注意：此函数的正则依赖 Keep 真实截图的版式，需要对着真实截图调优
// 当前先返回空结果，等拿到真实截图后再补
// ------------------------------------------------------------
function parseKeepScreenshot(text) {
  const result = {
    distanceKm: null,
    durationSeconds: null,
    paceSecondsPerKm: null,
    date: null,
  };

  // 基础记录截图版式（Keep + 小米运动健康通用）：
  //   - 距离：大字 "10.01" 或 "9.98"（OCR 可能把点吃掉变成 "998.."）
  //   - 用时：时:分:秒 格式 "00:55:30" 或 "00:55:41"
  //   - 配速：分'秒 格式 "05'32" 或 "5'34"
  //   - 其他数字：卡路里/心率/步数等，按位置和格式排除

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // 1) 找距离：优先找 "数字.数字" 格式；如果没找到，尝试把 "998.." 这种还原成 "9.98"
  for (const line of lines) {
    // 标准格式：10.01 或 5.20
    const m = line.match(/(\d+\.\d{1,2})/);
    if (m) {
      const d = parseFloat(m[1]);
      if (d >= 0.5 && d <= 100) {
        result.distanceKm = d;
        break;
      }
    }
  }
  // 如果没找到，尝试 OCR 把点吃掉的格式：998.. → 9.98 或 1001 → 10.01
  if (result.distanceKm === null) {
    for (const line of lines) {
      // 匹配 "998.." 或 "1001" 这种（3-4 位数字，可能带 .. 尾巴）
      const m = line.match(/^(\d{3,4})\.{0,2}$/);
      if (m) {
        const numStr = m[1];
        // 3 位 → 9.98，4 位 → 10.01
        if (numStr.length === 3) {
          const d = parseFloat(numStr[0] + '.' + numStr.substring(1));
          if (d >= 0.5 && d <= 100) {
            result.distanceKm = d;
            break;
          }
        } else if (numStr.length === 4) {
          const d = parseFloat(numStr.substring(0, 2) + '.' + numStr.substring(2));
          if (d >= 0.5 && d <= 100) {
            result.distanceKm = d;
            break;
          }
        }
      }
    }
  }

  // 2) 找用时：时:分:秒 格式（如 "00:55:30"）
  for (const line of lines) {
    const m = line.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (m) {
      const h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const sec = parseInt(m[3], 10);
      if (h < 6 && min < 60 && sec < 60) {
        result.durationSeconds = h * 3600 + min * 60 + sec;
        break;
      }
    }
  }

  // 3) 找配速：分'秒 格式（如 "05'32" 或 "5'34"）
  for (const line of lines) {
    const m = line.match(/(\d{1,2})'(\d{2})/);
    if (m) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      if (min >= 2 && min <= 20 && sec < 60) {
        result.paceSecondsPerKm = min * 60 + sec;
        break;
      }
    }
  }

  return result;
}

// ------------------------------------------------------------
// 解析详细数据截图（心率/触地时间/垂直振幅/步幅/步频）
// 支持 Keep 和小米运动健康
// 小米版式（已对着真实截图确认）：
//   - 心率：大字 "153" 和 "184"（平均和最大），取平均
//   - 步频：大字 "165" 和 "208"（平均和最高），取平均
//   - 步幅：大字 "103" 和 "173"（平均和最大），取平均
//   - 触地时间：大字 "259" 和 "207"（平均和最小），取平均
//   - 垂直振幅：大字 "9.5" 和 "6.7"（平均和最小），取平均
// ------------------------------------------------------------
function parseKeepDetailScreenshot(text) {
  const result = {
    heartRate: null,
    groundContactMs: null,
    verticalOscillationCm: null,
    strideLengthCm: null,
    cadenceSpm: null,
  };

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // 策略：小米截图版式固定——每个指标占一个区块，区块内第一行是大字（平均值）
  // 心率区块：大字 153 184（平均 最大）
  // 步频区块：大字 165 208（平均 最高）
  // 步幅区块：大字 103 173（平均 最大）
  // 触地时间区块：大字 259 207（平均 最小）
  // 垂直振幅区块：大字 9.5 6.7（平均 最小）

  // 先找"大字行"：3位数字 或 带一位小数（垂直振幅）
  const bigNumberLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 跳过时间轴和坐标轴
    if (line.match(/\d{2}:\d{2}:\d{2}/)) continue;
    if (line.match(/^\d{2}:\d{2}/)) continue;

    // 匹配 "103 173" 或 "259 207" 或 "9.5 6.7" 这种一行两个数字
    const nums = line.match(/\d+\.?\d*/g);
    if (nums && nums.length >= 2) {
      bigNumberLines.push({ line, nums, index: i });
    }
  }

  // 按数值范围分配指标
  for (const { nums } of bigNumberLines) {
    const first = parseFloat(nums[0]);
    // 垂直振幅：3-20 之间，带小数
    if (first >= 3 && first <= 20 && nums[0].includes('.')) {
      result.verticalOscillationCm = first;
      continue;
    }
    // 心率：30-220
    if (first >= 30 && first <= 220) {
      result.heartRate = first;
      continue;
    }
    // 触地时间：100-500
    if (first >= 100 && first <= 500) {
      result.groundContactMs = first;
      continue;
    }
    // 步幅：50-250
    if (first >= 50 && first <= 250) {
      result.strideLengthCm = first;
      continue;
    }
    // 步频：100-250
    if (first >= 100 && first <= 250) {
      result.cadenceSpm = first;
      continue;
    }
  }

  // 如果上面没找到，尝试单独找垂直振幅（小数格式）
  if (result.verticalOscillationCm === null) {
    for (const line of lines) {
      const m = line.match(/(\d+\.\d)/);
      if (m) {
        const v = parseFloat(m[1]);
        if (v >= 3 && v <= 20) {
          result.verticalOscillationCm = v;
          break;
        }
      }
    }
  }

  return result;
}

module.exports = router;
