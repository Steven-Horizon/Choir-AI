import { type ScoreAnalysis } from './score-analyzer';
import { generateDailyPlan, type DailyPlan } from './practice-plan-generator';

const STORAGE_KEY_TASKS = 'choirai_coach_tasks';
const STORAGE_KEY_ANALYSES = 'choirai_coach_analyses';
const STORAGE_KEY_HISTORY = 'choirai_coach_history';

export interface CoachState {
  todayPlan: DailyPlan | null;
  activeTasks: any[];
  scoreAnalyses: ScoreAnalysis[];
  streak: number;
  totalPracticeMinutes: number;
  lastPracticeDate: string | null;
}

export interface CoachSuggestion {
  type: 'warmup' | 'practice' | 'review' | 'rest';
  title: string;
  message: string;
  action: { label: string; route?: string };
  priority: 'high' | 'medium' | 'low';
}

export function loadCoachState(): CoachState {
  try {
    const tasksJson = localStorage.getItem(STORAGE_KEY_TASKS);
    const analysesJson = localStorage.getItem(STORAGE_KEY_ANALYSES);
    const historyJson = localStorage.getItem(STORAGE_KEY_HISTORY);
    const activeTasks = tasksJson ? JSON.parse(tasksJson) : [];
    const scoreAnalyses = analysesJson ? JSON.parse(analysesJson) : [];
    const history: { date: string; minutes: number }[] = historyJson ? JSON.parse(historyJson) : [];
    const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (sorted[0]?.date === today || sorted[0]?.date === yesterday) {
      streak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const d = (new Date(sorted[i - 1].date).getTime() - new Date(sorted[i].date).getTime()) / 86400000;
        if (d === 1) streak++; else break;
      }
    }
    return { todayPlan: null, activeTasks, scoreAnalyses, streak, totalPracticeMinutes: history.reduce((s, h) => s + h.minutes, 0), lastPracticeDate: sorted[0]?.date || null };
  } catch { return { todayPlan: null, activeTasks: [], scoreAnalyses: [], streak: 0, totalPracticeMinutes: 0, lastPracticeDate: null }; }
}

export function saveCoachState(state: CoachState) {
  localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(state.activeTasks));
  localStorage.setItem(STORAGE_KEY_ANALYSES, JSON.stringify(state.scoreAnalyses));
}

export function recordPractice(minutes: number) {
  const today = new Date().toISOString().split('T')[0];
  const history: { date: string; minutes: number }[] = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
  const entry = history.find(h => h.date === today);
  if (entry) entry.minutes += minutes; else history.push({ date: today, minutes });
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
}

export function getTodayPlan(voicePart: string, _level?: string, minutes?: number) {
  return generateDailyPlan(voicePart, minutes || 30);
}

export function addScoreAnalysis(analysis: ScoreAnalysis) {
  const state = loadCoachState();
  const idx = state.scoreAnalyses.findIndex(a => a.id === analysis.id);
  if (idx >= 0) state.scoreAnalyses[idx] = analysis; else state.scoreAnalyses.push(analysis);
  saveCoachState(state);
}

export function getCoachSuggestions(voicePart: string, hasScores: boolean, recentScores?: string[]): CoachSuggestion[] {
  const suggestions: CoachSuggestion[] = [];
  const hour = new Date().getHours();
  const state = loadCoachState();
  const today = new Date().toISOString().split('T')[0];

  if (state.lastPracticeDate !== today) {
    suggestions.push({ type: 'warmup', title: '今日还未练习', message: state.streak > 0 ? `今天还没练习哦，${state.streak}天的连击要断啦！` : '今天还没有练习记录，现在开始吧！', action: { label: '立即开始', route: '/warmup' }, priority: 'high' });
  }

  if (hour >= 6 && hour <= 10) {
    suggestions.push({ type: 'warmup', title: '晨间开声', message: `早上好！${voicePart === 'soprano' ? '女高' : voicePart === 'alto' ? '女低' : voicePart === 'tenor' ? '男高' : '男低'}同学，来做个开声练习吧。`, action: { label: '开始开声', route: '/warmup' }, priority: 'high' });
  } else if (hour >= 14 && hour <= 17) {
    suggestions.push({ type: 'practice', title: '下午练习时间', message: '下午嗓音状态好，适合练有难度的段落。', action: { label: '查看任务', route: '/plans' }, priority: 'medium' });
  }

  if (hasScores && recentScores?.length) {
    suggestions.push({ type: 'practice', title: `继续练习《${recentScores[0]}》`, message: '接着攻克难点吧！', action: { label: '继续练习', route: '/scores' }, priority: 'high' });
  } else if (!hasScores) {
    suggestions.push({ type: 'practice', title: '添加你的第一首谱子', message: '谱子库是空的，上传合唱谱开始训练吧！', action: { label: '去添加', route: '/scores' }, priority: 'high' });
  }

  if (state.streak > 0) {
    suggestions.push({ type: 'warmup', title: `连续练习${state.streak}天`, message: state.streak >= 7 ? '太棒了！坚持一周以上！' : `再坚持${7 - state.streak}天达成周目标！`, action: { label: '今日计划', route: '/plans' }, priority: 'medium' });
  }

  return suggestions.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]));
}

export function getVoicePartColor(vp: string) {
  const c: Record<string, string> = { soprano: 'text-pink-400 bg-pink-500/10 border-pink-500/20', alto: 'text-purple-400 bg-purple-500/10 border-purple-500/20', tenor: 'text-blue-400 bg-blue-500/10 border-blue-500/20', bass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', all: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
  return c[vp] || c.all;
}

export function getVoicePartName(vp: string) { const n: Record<string, string> = { soprano: '女高音', alto: '女低音', tenor: '男高音', bass: '男低音', all: '全体' }; return n[vp] || vp; }
export function getDifficultyLabel(d: string) { const l: Record<string, { text: string; color: string }> = { easy: { text: '简单', color: 'text-green-400 bg-green-500/10' }, medium: { text: '中等', color: 'text-yellow-400 bg-yellow-500/10' }, hard: { text: '困难', color: 'text-orange-400 bg-orange-500/10' }, expert: { text: '专家', color: 'text-red-400 bg-red-500/10' } }; return l[d] || { text: '未知', color: 'text-gray-400 bg-gray-500/10' }; }
