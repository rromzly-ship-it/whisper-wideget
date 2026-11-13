/**
 * Registry Skill Modular Whisper Agent (Wis)
 * Memuat seluruh modul skill secara terstruktur, menyediakan:
 * 1. tryMatchFastSkill(transcript) -> eksekusi instan 0 token
 * 2. getPromptSkillModules(lowTranscript, forceAll) -> Progressive Skill Disclosure hemat token
 * 3. listAllSkills() -> daftar seluruh modul skill yang terpasang
 */
const greetingSkill = require('./greeting');
const browserSkill = require('./browser');
const mediaSkill = require('./media');
const scrollZoomSkill = require('./scroll-zoom');
const windowSkill = require('./window');
const visionSkill = require('./vision');
const wordSkill = require('./word');
const memorySkill = require('./memory');
const brightnessSkill = require('./brightness');
const whatsappSkill = require('./whatsapp');
const telegramSkill = require('./telegram');
const filesSkill = require('./files');
const macroSkill = require('./macro');
const appsKnowledgeSkill = require('./apps-knowledge');

const SKILL_MODULES = [
  greetingSkill,
  appsKnowledgeSkill,
  visionSkill,
  mediaSkill,
  browserSkill,
  brightnessSkill,
  whatsappSkill,
  telegramSkill,
  filesSkill,
  macroSkill,
  scrollZoomSkill,
  windowSkill,
  wordSkill,
  memorySkill
];

function tryMatchFastSkill(transcript) {
  const raw = String(transcript || '').trim();
  if (!raw || /\b(belajar|pelajari|ingat|gimana|bagaimana)\b/i.test(raw)) {
    return null;
  }

  const rawLow = raw.toLowerCase().replace(/[.!?]+$/g, '').trim();
  const clean = rawLow
    .replace(/^(?:(?:hai|halo|hei|hi|hey|high|oke|coba|tolong|wis|kawan|bro|sis)\s*[,.!]?\s*)+/i, '')
    .replace(/[.!?]+$/g, '')
    .trim();

  for (const mod of SKILL_MODULES) {
    if (typeof mod.matchFastPlan === 'function') {
      const plan = mod.matchFastPlan({ raw, rawLow, clean });
      if (plan) {
        return { ...plan, skillId: mod.id };
      }
    }
  }
  return null;
}

function getPromptSkillModules(lowTranscript, hasMatchedUserSkills = false) {
  const specs = [];
  for (const mod of SKILL_MODULES) {
    if (!mod.promptSpec) continue;
    if (hasMatchedUserSkills || (mod.intentPattern && mod.intentPattern.test(lowTranscript))) {
      specs.push(mod.promptSpec);
    }
  }
  return specs;
}

function listAllSkills() {
  return SKILL_MODULES.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    description: m.description,
    hasFastPath: typeof m.matchFastPlan === 'function',
    examples: m.examples || []
  }));
}

module.exports = {
  SKILL_MODULES,
  tryMatchFastSkill,
  getPromptSkillModules,
  listAllSkills
};

