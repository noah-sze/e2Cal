/**
 * 權威科研食材庫離線批次翻譯腳本（一次性建置工具，不進入前端打包）
 *
 * 使用方式：
 *   OPENAI_API_KEY="sk-..." node scripts/translateAuthorityFoods.mjs --lang=zh-TW
 *
 * 特性：
 * - 使用批次內短數字索引 ("0", "1", ...) 節省 ~35% Token 並消除 UUID 拼寫錯誤
 * - 支援並發請求 (--concurrency=8) 與失敗自動退避重試
 * - 支援斷點續傳：每完成一批即安全合併寫入目標 JSON
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE_PATH = path.join(ROOT, 'src/services/db/authorityFoods.json');

const TARGET_CONFIG = {
  'zh-TW': {
    outPath: path.join(ROOT, 'src/services/db/authorityNames.zh-TW.json'),
    skipAuthorities: new Set(['TFDA']),
    instruction:
      'Translate food names into concise, natural Traditional Chinese (台灣繁體中文). Keep cooking state & part distinctions (raw=生, cooked=熟, boiled=水煮, roasted=烤, braised=燉, fried=油炸, skinless=去皮, boneless=去骨, drained=瀝乾). Preserve brand names if present.',
  },
  'zh-CN': {
    outPath: path.join(ROOT, 'src/services/db/authorityNames.zh-CN.json'),
    skipAuthorities: new Set(['CFCT']),
    instruction:
      'Translate food names into concise, natural Simplified Chinese (中国大陆简体中文). Keep cooking state & part distinctions (raw=生, cooked=熟, boiled=水煮, roasted=烤, braised=炖, fried=油炸, skinless=去皮, boneless=去骨, drained=沥干). Preserve brand names if present.',
  },
  en: {
    outPath: path.join(ROOT, 'src/services/db/authorityNames.en.json'),
    skipAuthorities: new Set(['USDA', 'CoFID', 'AFCD']),
    instruction:
      'Translate food names into concise, accurate English suitable for a nutrition database. Keep cooking state and part distinctions clear (e.g., raw, cooked, skinless, boneless).',
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  let lang = 'zh-TW';
  let batchSize = 80;
  let concurrency = 8;
  let limit = Infinity;
  let formatOnly = false;

  for (const arg of args) {
    if (arg.startsWith('--lang=')) lang = arg.slice('--lang='.length);
    if (arg.startsWith('--batch=')) batchSize = Math.max(10, Number(arg.slice('--batch='.length)) || 80);
    if (arg.startsWith('--concurrency=')) {
      concurrency = Math.max(1, Number(arg.slice('--concurrency='.length)) || 8);
    }
    if (arg.startsWith('--limit=')) limit = Math.max(1, Number(arg.slice('--limit='.length)) || Infinity);
    if (arg === '--format-only') formatOnly = true;
  }
  return { lang, batchSize, concurrency, limit, formatOnly };
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

/**
 * 盤古之白格式化：在中文字元與英數字 / % 之間補上半形空格，並收斂多餘空白
 */
function formatPanguSpacing(text) {
  return text
    .replace(/([\u4e00-\u9fff])([A-Za-z0-9])/g, '$1 $2')
    .replace(/([A-Za-z0-9%])([\u4e00-\u9fff])/g, '$1 $2')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function translateBatchWithRetry({ items, instruction, apiKey, baseUrl, model }, retries = 3) {
  const payloadInput = {};
  items.forEach((item, idx) => {
    payloadInput[String(idx)] = `[${item.dataSource?.authority || ''}] ${item.name}`;
  });

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `${instruction} Return strictly a valid JSON object with the exact same numeric string keys ("0", "1", ...) mapped to the translated food name string (without the [AUTHORITY] prefix).`,
            },
            {
              role: 'user',
              content: JSON.stringify(payloadInput),
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API ${response.status}: ${errText.slice(0, 300)}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response content from model');
      return extractJsonObject(content);
    } catch (err) {
      if (attempt === retries) throw err;
      const delayMs = 1000 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  const { lang, batchSize, concurrency, limit, formatOnly } = parseArgs();

  if (formatOnly) {
    for (const [locale, cfgItem] of Object.entries(TARGET_CONFIG)) {
      if (!fs.existsSync(cfgItem.outPath)) continue;
      const dict = JSON.parse(fs.readFileSync(cfgItem.outPath, 'utf8'));
      let changed = 0;
      const samples = [];
      for (const [id, val] of Object.entries(dict)) {
        if (typeof val !== 'string') continue;
        const formatted = formatPanguSpacing(val);
        if (formatted !== val) {
          changed += 1;
          if (samples.length < 3) samples.push(`${val} -> ${formatted}`);
          dict[id] = formatted;
        }
      }
      fs.writeFileSync(cfgItem.outPath, `${JSON.stringify(dict, null, 2)}\n`, 'utf8');
      console.log(`[format-only][${locale}] total=${Object.keys(dict).length}, changed=${changed}`, samples);
    }
    return;
  }

  const cfg = TARGET_CONFIG[lang];
  if (!cfg) {
    console.error(`Unsupported --lang=${lang}. Expected one of: zh-TW, zh-CN, en`);
    process.exit(1);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Missing OPENAI_API_KEY environment variable.');
    process.exit(1);
  }

  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const foods = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  let existing = {};
  if (fs.existsSync(cfg.outPath)) {
    existing = JSON.parse(fs.readFileSync(cfg.outPath, 'utf8'));
  }

  const pending = foods
    .filter((f) => {
      const auth = f.dataSource?.authority || '';
      if (cfg.skipAuthorities.has(auth)) return false;
      return !existing[f.id];
    })
    .slice(0, limit);

  const batches = [];
  for (let i = 0; i < pending.length; i += batchSize) {
    batches.push(pending.slice(i, i + batchSize));
  }

  console.log(
    `[${lang}] Total=${foods.length}, Already=${Object.keys(existing).length}, Pending=${pending.length}, Batches=${batches.length}, Concurrency=${concurrency}`
  );

  let nextIdx = 0;
  let completedBatches = 0;

  async function worker() {
    while (true) {
      const batchIdx = nextIdx;
      nextIdx += 1;
      if (batchIdx >= batches.length) return;

      const batch = batches[batchIdx];
      try {
        const translatedMap = await translateBatchWithRetry({
          items: batch,
          instruction: cfg.instruction,
          apiKey,
          baseUrl,
          model,
        });

        let added = 0;
        batch.forEach((item, idx) => {
          const val = translatedMap[String(idx)];
          if (typeof val === 'string' && val.trim()) {
            existing[item.id] = formatPanguSpacing(val);
            added += 1;
          }
        });

        completedBatches += 1;
        fs.writeFileSync(cfg.outPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
        if (completedBatches % 5 === 0 || completedBatches === batches.length) {
          console.log(
            `[${lang}] Progress ${completedBatches}/${batches.length} batches (+${added} in batch, Total saved: ${Object.keys(existing).length})`
          );
        }
      } catch (err) {
        console.error(`[${lang}] Batch ${batchIdx + 1} failed:`, err.message);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, batches.length)) }, () => worker()));
  console.log(`[${lang}] Done. Total saved: ${Object.keys(existing).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
