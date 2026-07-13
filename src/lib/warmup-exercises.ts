// 开声练习条目库 - 基于校合唱团开声条目与细则
// 条目来源：开声条目与细则文档

export interface WarmUpExercise {
  id: string;
  category: string;
  name: string;
  notation: string;
  description: string;
  tags: string[];
  order: number;
}

// ===== 一、打嘟 =====
const SECTION_1: WarmUpExercise[] = [
  {
    id: 'lip_1',
    category: '一、打嘟',
    name: '打嘟上行下行',
    notation: '123454321',
    description: '双唇放松，用气息带动打嘟，从中音区上行到高音再返回',
    tags: ['打嘟', '基础'],
    order: 1,
  },
];

// ===== 二、基础训练 =====
const SECTION_2: WarmUpExercise[] = [
  {
    id: 'basic_1',
    category: '二、基础训练',
    name: '五度下行',
    notation: '54321',
    description: '从sol下行到do，平稳过渡',
    tags: ['基础', '下行'],
    order: 2,
  },
  {
    id: 'basic_2',
    category: '二、基础训练',
    name: '持续音+下行',
    notation: '5-5-5-5-54321',
    description: 'sol保持四拍后下行到do，练习气息持续',
    tags: ['基础', '气息'],
    order: 3,
  },
  {
    id: 'basic_3',
    category: '二、基础训练',
    name: '二度级进',
    notation: '5654543432321',
    description: '二度上下级进，注意音准',
    tags: ['基础', '级进'],
    order: 4,
  },
  {
    id: 'basic_4',
    category: '二、基础训练',
    name: '五度变速',
    notation: '12345432（慢）123454321（快）',
    description: '先慢速后快速，练习灵活性',
    tags: ['基础', '变速'],
    order: 5,
  },
  {
    id: 'basic_5',
    category: '二、基础训练',
    name: '跳进练习①',
    notation: '1555653542431（跳）',
    description: '四度跳进，注意音准和气息',
    tags: ['基础', '跳进'],
    order: 6,
  },
  {
    id: 'basic_6',
    category: '二、基础训练',
    name: '跳进练习②',
    notation: '1555531555531（跳）',
    description: '八度跳进练习，头声转换',
    tags: ['基础', '跳进', '八度'],
    order: 7,
  },
  {
    id: 'basic_7',
    category: '二、基础训练',
    name: '五度往返',
    notation: '54321 12345 5432123454321',
    description: '下行后上行再往返，练习音域控制',
    tags: ['基础', '往返'],
    order: 8,
  },
  {
    id: 'basic_8',
    category: '二、基础训练',
    name: '七度上行下行',
    notation: '13579-8531',
    description: '五声音阶上行到高la后下行',
    tags: ['基础', '五声音阶'],
    order: 9,
  },
  {
    id: 'basic_9',
    category: '二、基础训练',
    name: '八度练习',
    notation: '1-8-531',
    description: '八度大跳后下行，练习音域扩展',
    tags: ['基础', '八度'],
    order: 10,
  },
];

// ===== 三、音层训练 =====
const SECTION_3: WarmUpExercise[] = [
  {
    id: 'layer_1',
    category: '三、音层训练',
    name: '八度交替',
    notation: '151 181',
    description: '八度音交替演唱，统一音色',
    tags: ['音层', '八度'],
    order: 11,
  },
  {
    id: 'layer_2',
    category: '三、音层训练',
    name: '大三度模唱',
    notation: '13 123 13',
    description: '大三度音程模唱练习',
    tags: ['音层', '大三度', '音程'],
    order: 12,
  },
  {
    id: 'layer_3',
    category: '三、音层训练',
    name: '小三度模唱',
    notation: '61 671 61',
    description: '小三度音程模唱练习',
    tags: ['音层', '小三度', '音程'],
    order: 13,
  },
];

// ===== 四、音阶 =====
const SECTION_4: WarmUpExercise[] = [
  {
    id: 'scale_1_up',
    category: '四、音阶',
    name: '音阶上行（级进扩展）',
    notation: '1 121 12321 1234321 123454321 12345654321 1234567654321 i i',
    description: '逐层扩展的上行音阶练习',
    tags: ['音阶', '上行'],
    order: 14,
  },
  {
    id: 'scale_1_down',
    category: '四、音阶',
    name: '音阶下行（级进扩展）',
    notation: 'i 878 87678 8765678 876545678 87654345678 8765432345678 1 1',
    description: '逐层扩展的下行音阶练习',
    tags: ['音阶', '下行'],
    order: 15,
  },
  {
    id: 'scale_2_up',
    category: '四、音阶',
    name: '音阶上行（三度）',
    notation: '1324354657768798',
    description: '三度音程上行音阶',
    tags: ['音阶', '上行', '三度'],
    order: 16,
  },
  {
    id: 'scale_2_down',
    category: '四、音阶',
    name: '音阶下行（三度）',
    notation: '3127167564534231271',
    description: '三度音程下行音阶',
    tags: ['音阶', '下行', '三度'],
    order: 17,
  },
  {
    id: 'scale_3_up',
    category: '四、音阶',
    name: '跳音上行',
    notation: '11171222 33323444 55545666 77767888（跳）',
    description: '分组跳音上行练习',
    tags: ['音阶', '上行', '跳音'],
    order: 18,
  },
  {
    id: 'scale_3_down_high',
    category: '四、音阶',
    name: '跳音下行（高音）',
    notation: '（高）33321222 11176777 66654555 44432111',
    description: '高音区跳音下行',
    tags: ['音阶', '下行', '跳音'],
    order: 19,
  },
  {
    id: 'scale_3_down_low',
    category: '四、音阶',
    name: '跳音下行（低音）',
    notation: '（低）11176777 66654555 44432333 22217111',
    description: '低音区跳音下行',
    tags: ['音阶', '下行', '跳音'],
    order: 20,
  },
  {
    id: 'scale_4_up',
    category: '四、音阶',
    name: '半音上行',
    notation: '121314152535455',
    description: '半音阶级进上行',
    tags: ['音阶', '上行', '半音'],
    order: 21,
  },
  {
    id: 'scale_4_down',
    category: '四、音阶',
    name: '半音下行',
    notation: '545352514131211',
    description: '半音阶级进下行',
    tags: ['音阶', '下行', '半音'],
    order: 22,
  },
];

// ===== 五、和声 =====
const SECTION_5: WarmUpExercise[] = [
  {
    id: 'harmony_1',
    category: '五、和声',
    name: '大三度和弦',
    notation: '135i',
    description: '大三度叠置和弦，135高音1',
    tags: ['和声', '大三度', '和弦'],
    order: 23,
  },
  {
    id: 'harmony_2',
    category: '五、和声',
    name: '小三度和弦',
    notation: '6136',
    description: '小三度叠置和弦',
    tags: ['和声', '小三度', '和弦'],
    order: 24,
  },
];

// ===== 六、开声曲 =====
const SECTION_6: WarmUpExercise[] = [
  {
    id: 'song_1',
    category: '六、开声曲',
    name: '送别',
    notation: '535i-6i5-5123212--',
    description: '经典开声曲，柔和共鸣',
    tags: ['开声曲', '送别'],
    order: 25,
  },
  {
    id: 'song_2',
    category: '六、开声曲',
    name: '花非花',
    notation: '黄自作曲，朦胧意境的练习曲',
    description: '练习气息连贯和音色统一',
    tags: ['开声曲', '花非花'],
    order: 26,
  },
  {
    id: 'song_3',
    category: '六、开声曲',
    name: '渔光曲',
    notation: '轻柔悠长，适合练气息支撑',
    description: '练习气息控制和声音延展',
    tags: ['开声曲', '渔光曲'],
    order: 27,
  },
];

// 全部条目
export const WARMUP_EXERCISES: WarmUpExercise[] = [
  ...SECTION_1,
  ...SECTION_2,
  ...SECTION_3,
  ...SECTION_4,
  ...SECTION_5,
  ...SECTION_6,
];

// 按分类获取
export function getExercisesByCategory(category: string): WarmUpExercise[] {
  return WARMUP_EXERCISES.filter(e => e.category === category);
}

// 获取所有分类
export function getCategories(): string[] {
  return [...new Set(WARMUP_EXERCISES.map(e => e.category))];
}

// 生成今日开声计划（按顺序取前N条）
export function generateDailyWarmup(count: number = 10): WarmUpExercise[] {
  return WARMUP_EXERCISES.slice(0, count);
}

// 开声曲列表
export const WARMUP_SONGS = SECTION_6;

// 声部建议
export const VOICE_PART_TIPS: Record<string, string[]> = {
  soprano: [
    '高音区注意头腔共鸣，想象声音从眉心发出',
    '避免过度用力，用气息推动而非喉咙挤压',
    '八度大跳时做好换声准备',
  ],
  alto: [
    '中声区是优势音域，保持共鸣饱满',
    '与女高音的音程关系要准确，多听上方声部',
    '低音区不要压喉，保持空间感',
  ],
  tenor: [
    '换声区(passaggio)要平滑过渡',
    '高音区不要捏紧，保持开放喉位',
    '注意与男低音的和声支撑关系',
  ],
  bass: [
    '低音区注意气息深度支撑',
    '是整个合唱团的和声基础，保持音准稳定',
    '高音区可用混声，不要强迫',
  ],
};
