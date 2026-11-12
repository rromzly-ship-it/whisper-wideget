const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const KNOWN_DEFAULT_TPD = {
  'openai/gpt-oss-20b': 200000,
  'openai/gpt-oss-120b': 200000
};

let storeCache = null;

function getUsageFilePath() {
  return path.join(app.getPath('userData'), 'wis-usage.json');
}

function getTodayDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getKeyFingerprint(apiKey) {
  const clean = String(apiKey || '').trim();
  if (!clean) return 'no-key';
  return crypto.createHash('sha256').update(clean).digest('hex').slice(0, 12);
}

function getKeyHint(apiKey) {
  const clean = String(apiKey || '').trim();
  if (!clean) return 'Belum diisi';
  if (clean.length <= 8) return `•••${clean.slice(-2)}`;
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}

function loadStore() {
  if (storeCache) return storeCache;
  try {
    const file = getUsageFilePath();
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        storeCache = {
          customLimitsByKey: parsed.customLimitsByKey || {},
          days: parsed.days || {}
        };
        return storeCache;
      }
    }
  } catch {}
  storeCache = { customLimitsByKey: {}, days: {} };
  return storeCache;
}

function saveStore() {
  if (!storeCache) return;
  try {
    // Keep only last 14 days to avoid unbounded file growth
    const dateKeys = Object.keys(storeCache.days).sort();
    while (dateKeys.length > 14) {
      const oldest = dateKeys.shift();
      delete storeCache.days[oldest];
    }
    fs.writeFileSync(getUsageFilePath(), JSON.stringify(storeCache, null, 2), 'utf8');
  } catch {}
}

function ensureBucket(apiKey) {
  const store = loadStore();
  const dateKey = getTodayDateKey();
  const fp = getKeyFingerprint(apiKey);
  if (!store.days[dateKey]) store.days[dateKey] = {};
  if (!store.days[dateKey][fp]) {
    store.days[dateKey][fp] = {
      keyHint: getKeyHint(apiKey),
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      visionTokens: 0,
      llmCalls: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      taskTokenSamples: 0,
      sumTaskTokens: 0,
      whisperCalls: 0,
      whisperSeconds: 0,
      models: {},
      recentTasks: []
    };
  } else {
    store.days[dateKey][fp].keyHint = getKeyHint(apiKey);
  }
  return { store, dateKey, fp, bucket: store.days[dateKey][fp] };
}

function ensureModelBucket(bucket, modelName) {
  const m = String(modelName || 'openai/gpt-oss-20b').trim();
  if (!bucket.models[m]) {
    bucket.models[m] = {
      model: m,
      tokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      calls: 0,
      tpdLimit: KNOWN_DEFAULT_TPD[m] || null,
      tpdUsedServer: 0,
      tpmLimit: null,
      tpmRemaining: null,
      tpmReset: '',
      rpdLimit: null,
      rpdRemaining: null,
      rpdReset: '',
      lastError: '',
      updatedAt: 0
    };
  }
  return bucket.models[m];
}

function applyHeadersToModelBucket(mb, headers) {
  if (!headers || typeof headers.get !== 'function') return;
  const toNum = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const tpmLim = toNum(headers.get('x-ratelimit-limit-tokens'));
  const tpmRem = toNum(headers.get('x-ratelimit-remaining-tokens'));
  const rpdLim = toNum(headers.get('x-ratelimit-limit-requests'));
  const rpdRem = toNum(headers.get('x-ratelimit-remaining-requests'));

  if (tpmLim !== null) mb.tpmLimit = tpmLim;
  if (tpmRem !== null) mb.tpmRemaining = tpmRem;
  if (headers.get('x-ratelimit-reset-tokens')) mb.tpmReset = headers.get('x-ratelimit-reset-tokens');
  if (rpdLim !== null) mb.rpdLimit = rpdLim;
  if (rpdRem !== null) mb.rpdRemaining = rpdRem;
  if (headers.get('x-ratelimit-reset-requests')) mb.rpdReset = headers.get('x-ratelimit-reset-requests');
  mb.updatedAt = Date.now();
}

function recordLlmCall({ apiKey, model, phase = 'planner', usage = {}, headers = null }) {
  if (!apiKey) return;
  const { bucket } = ensureBucket(apiKey);
  const mb = ensureModelBucket(bucket, model);

  const pTok = Math.max(0, Number(usage.prompt_tokens || usage.promptTokens || 0));
  const cTok = Math.max(0, Number(usage.completion_tokens || usage.completionTokens || 0));
  const tTok = Math.max(0, Number(usage.total_tokens || usage.totalTokens || (pTok + cTok)));

  bucket.promptTokens += pTok;
  bucket.completionTokens += cTok;
  bucket.totalTokens += tTok;
  if (phase === 'vision') bucket.visionTokens += tTok;
  bucket.llmCalls += 1;

  mb.promptTokens += pTok;
  mb.completionTokens += cTok;
  mb.tokens += tTok;
  mb.calls += 1;
  mb.lastError = '';
  if (mb.tpdUsedServer > 0) {
    mb.tpdUsedServer += tTok;
  }
  applyHeadersToModelBucket(mb, headers);
  saveStore();
}

function recordRateLimitError({ apiKey, model, errMsg, headers = null }) {
  if (!apiKey) return;
  const { bucket } = ensureBucket(apiKey);
  const mb = ensureModelBucket(bucket, model);
  applyHeadersToModelBucket(mb, headers);

  const msg = String(errMsg || '');
  const tpdMatch = msg.match(/tokens per day\s*\(TPD\):\s*Limit\s*(\d+),\s*Used\s*(\d+)/i);
  if (tpdMatch) {
    mb.tpdLimit = Number(tpdMatch[1]);
    mb.tpdUsedServer = Math.max(mb.tpdUsedServer || 0, Number(tpdMatch[2]));
  }
  const tpmMatch = msg.match(/tokens per minute\s*\(TPM\):\s*Limit\s*(\d+),\s*Used\s*(\d+)/i);
  if (tpmMatch) {
    const lim = Number(tpmMatch[1]);
    const used = Number(tpmMatch[2]);
    mb.tpmLimit = lim;
    mb.tpmRemaining = Math.max(0, lim - used);
  }
  const rpdMatch = msg.match(/requests per day\s*\(RPD\):\s*Limit\s*(\d+),\s*Used\s*(\d+)/i);
  if (rpdMatch) {
    const lim = Number(rpdMatch[1]);
    const used = Number(rpdMatch[2]);
    mb.rpdLimit = lim;
    mb.rpdRemaining = Math.max(0, lim - used);
  }
  mb.lastError = msg.slice(0, 180);
  mb.updatedAt = Date.now();
  saveStore();
}

function recordWhisperCall({ apiKey, model, audioSeconds = 0, headers = null }) {
  if (!apiKey) return;
  const { bucket } = ensureBucket(apiKey);
  const mb = ensureModelBucket(bucket, model || 'whisper-large-v3');
  const sec = Math.max(0, Number(audioSeconds || 0));
  bucket.whisperCalls += 1;
  bucket.whisperSeconds = Number((bucket.whisperSeconds + sec).toFixed(2));
  mb.calls += 1;
  applyHeadersToModelBucket(mb, headers);
  saveStore();
}

function recordTaskResult({ apiKey, id, transcript, status, model, usage = {} }) {
  if (!apiKey) return;
  const { bucket } = ensureBucket(apiKey);
  if (status === 'done') bucket.tasksCompleted += 1;
  else if (status === 'error') bucket.tasksFailed += 1;

  const totalTokens = Math.max(0, Number(usage.totalTokens || 0));
  if (totalTokens > 0) {
    bucket.taskTokenSamples += 1;
    bucket.sumTaskTokens += totalTokens;
  }

  bucket.recentTasks.unshift({
    id,
    transcript: String(transcript || '').slice(0, 90),
    status,
    model: model || usage.llmModel || 'openai/gpt-oss-20b',
    totalTokens,
    promptTokens: Number(usage.promptTokens || 0),
    completionTokens: Number(usage.completionTokens || 0),
    visionTokens: Number(usage.visionTokens || 0),
    createdAt: Date.now()
  });
  if (bucket.recentTasks.length > 20) {
    bucket.recentTasks.length = 20;
  }
  saveStore();
}

function setCustomDailyTokenLimit(apiKey, limitVal) {
  const { store, fp } = ensureBucket(apiKey);
  const num = Number(limitVal);
  if (Number.isFinite(num) && num >= 1000) {
    store.customLimitsByKey[fp] = Math.round(num);
  } else {
    delete store.customLimitsByKey[fp];
  }
  saveStore();
  return getSummary(apiKey);
}

function resetTodayUsage(apiKey) {
  const store = loadStore();
  const dateKey = getTodayDateKey();
  const fp = getKeyFingerprint(apiKey);
  if (store.days[dateKey]) {
    delete store.days[dateKey][fp];
    saveStore();
  }
  return getSummary(apiKey);
}

function getSummary(apiKey, primaryModel = 'openai/gpt-oss-20b') {
  const { store, dateKey, fp, bucket } = ensureBucket(apiKey);
  const mb = bucket.models[primaryModel] || null;
  const customLimit = store.customLimitsByKey[fp] || null;
  const dailyTokenLimit = customLimit || (mb && mb.tpdLimit) || KNOWN_DEFAULT_TPD[primaryModel] || null;

  const modelTokensUsed = mb ? mb.tokens : 0;
  const serverUsed = mb ? (mb.tpdUsedServer || 0) : 0;
  const primaryTokensUsed = Math.max(modelTokensUsed, serverUsed);
  const remainingDailyTokens = dailyTokenLimit !== null
    ? Math.max(0, dailyTokenLimit - primaryTokensUsed)
    : null;

  const avgTokensPerTask = bucket.taskTokenSamples > 0
    ? Math.round(bucket.sumTaskTokens / bucket.taskTokenSamples)
    : 1350;

  const rpdLimit = mb && mb.rpdLimit !== null ? mb.rpdLimit : null;
  const rpdRemaining = mb && mb.rpdRemaining !== null ? mb.rpdRemaining : null;

  let estimatedTasksPerDay = dailyTokenLimit !== null
    ? Math.floor(dailyTokenLimit / Math.max(1, avgTokensPerTask))
    : (rpdLimit !== null ? rpdLimit : null);
  if (rpdLimit !== null && estimatedTasksPerDay !== null) {
    estimatedTasksPerDay = Math.min(estimatedTasksPerDay, rpdLimit);
  }

  let estimatedRemainingTasksToday = remainingDailyTokens !== null
    ? Math.floor(remainingDailyTokens / Math.max(1, avgTokensPerTask))
    : (rpdRemaining !== null ? rpdRemaining : null);
  if (rpdRemaining !== null && estimatedRemainingTasksToday !== null) {
    estimatedRemainingTasksToday = Math.min(estimatedRemainingTasksToday, rpdRemaining);
  }

  return {
    date: dateKey,
    hasApiKey: Boolean(String(apiKey || '').trim()),
    keyFingerprint: fp,
    keyHint: bucket.keyHint,
    primaryModel,
    customDailyTokenLimit: customLimit,
    dailyTokenLimit,
    totalTokensToday: bucket.totalTokens,
    promptTokensToday: bucket.promptTokens,
    completionTokensToday: bucket.completionTokens,
    visionTokensToday: bucket.visionTokens,
    primaryTokensUsed,
    serverCalibratedUsed: serverUsed,
    remainingDailyTokens,
    llmCallsToday: bucket.llmCalls,
    tasksCompletedToday: bucket.tasksCompleted,
    tasksFailedToday: bucket.tasksFailed,
    taskTokenSamples: bucket.taskTokenSamples,
    avgTokensPerTask,
    isEstimatedAvg: bucket.taskTokenSamples === 0,
    estimatedTasksPerDay,
    estimatedRemainingTasksToday,
    whisperCallsToday: bucket.whisperCalls,
    whisperSecondsToday: bucket.whisperSeconds,
    rpdLimit,
    rpdRemaining,
    rpdReset: mb ? mb.rpdReset : '',
    tpmLimit: mb && mb.tpmLimit !== null ? mb.tpmLimit : null,
    tpmRemaining: mb && mb.tpmRemaining !== null ? mb.tpmRemaining : null,
    tpmReset: mb ? mb.tpmReset : '',
    models: Object.values(bucket.models).sort((a, b) => (b.tokens - a.tokens) || (b.calls - a.calls)),
    recentTasks: bucket.recentTasks
  };
}

module.exports = {
  getKeyFingerprint,
  recordLlmCall,
  recordRateLimitError,
  recordWhisperCall,
  recordTaskResult,
  setCustomDailyTokenLimit,
  resetTodayUsage,
  getSummary
};

