import { WARMUP_EXERCISES, VOICE_PART_TIPS, WARMUP_SONGS } from './warmup-exercises';

export interface PracticeTask {
  id: string;
  type: 'warmup' | 'section_practice' | 'full_run' | 'review';
  title: string;
  description: string;
  duration: number;
  priority: 'high' | 'medium' | 'low';
  voicePart: string;
  scoreId?: string;
  scoreTitle?: string;
  tips: string[];
  completed: boolean;
  createdAt: string;
}

export interface DailyPlan {
  date: string;
  totalDuration: number;
  tasks: PracticeTask[];
  focus: string;
  message: string;
}

export function generateDailyPlan(voicePart: string, availableMinutes: number = 30): DailyPlan {
  const date = new Date().toISOString().split('T')[0];
  const exercises = WARMUP_EXERCISES.slice(0, Math.min(8, WARMUP_EXERCISES.length));
  const tips = VOICE_PART_TIPS[voicePart] || VOICE_PART_TIPS.soprano;

  const tasks: PracticeTask[] = exercises.map((ex, idx) => ({
    id: `warmup_${ex.id}_${date}`,
    type: 'warmup',
    title: ex.name,
    description: `${ex.notation} — ${ex.description}`,
    duration: 3,
    priority: idx < 3 ? 'high' : 'medium',
    voicePart,
    tips: idx === 0 ? tips : [ex.description],
    completed: false,
    createdAt: new Date().toISOString(),
  }));

  tasks.push({
    id: `song_${date}`,
    type: 'review',
    title: '开声曲练习',
    description: WARMUP_SONGS.map(s => s.name).join('、'),
    duration: 8,
    priority: 'medium',
    voicePart,
    tips: ['注意气息连贯', '保持共鸣位置统一'],
    completed: false,
    createdAt: new Date().toISOString(),
  });

  const selectedTasks = tasks.filter(() => {
    const total = tasks.filter(st => !st.completed).reduce((s, st) => s + st.duration, 0);
    return total <= availableMinutes;
  });

  return {
    date,
    totalDuration: selectedTasks.reduce((s, t) => s + t.duration, 0),
    tasks: selectedTasks,
    focus: `${voicePart === 'soprano' ? '女高音' : voicePart === 'alto' ? '女低音' : voicePart === 'tenor' ? '男高音' : '男低音'}基础训练`,
    message: `今天我们从打嘟开始，逐步完成${tasks.length}项开声练习`,
  };
}

export function getTodayWarmup(voicePart: string) {
  return {
    exercises: WARMUP_EXERCISES,
    tips: VOICE_PART_TIPS[voicePart] || VOICE_PART_TIPS.soprano,
  };
}
