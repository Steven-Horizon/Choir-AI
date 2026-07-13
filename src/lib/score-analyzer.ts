export interface ScoreAnalysis {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  difficultyScore: number;
  key: string;
  timeSignature: string;
  tempo: number;
  difficultSections: {
    measureStart: number;
    measureEnd: number;
    type: string;
    description: string;
    voiceParts: string[];
    severity: 'low' | 'medium' | 'high';
  }[];
  analyzedAt: string;
}

export function analyzeScoreMetadata(
  scoreId: string,
  title: string,
  metadata: {
    voiceParts?: string[];
    key?: string;
    timeSignature?: string;
    tempo?: number;
    composer?: string;
  }
): ScoreAnalysis {
  const { key = 'C', timeSignature = '4/4', tempo = 120, voiceParts = ['soprano', 'alto', 'tenor', 'bass'] } = metadata;

  const knownWorks: Record<string, { difficulty: ScoreAnalysis['difficulty']; score: number }> = {
    '送别': { difficulty: 'easy', score: 20 },
    '花非花': { difficulty: 'easy', score: 30 },
    '渔光曲': { difficulty: 'medium', score: 45 },
    '阿拉木汗': { difficulty: 'hard', score: 65 },
    '茉莉花': { difficulty: 'easy', score: 25 },
    '天鹅': { difficulty: 'medium', score: 45 },
    '保卫黄河': { difficulty: 'expert', score: 85 },
  };

  const known = knownWorks[title];
  const difficultyScore = known?.score || 30;
  const difficulty: ScoreAnalysis['difficulty'] =
    difficultyScore < 30 ? 'easy' : difficultyScore < 55 ? 'medium' : difficultyScore < 80 ? 'hard' : 'expert';

  const difficultSections: ScoreAnalysis['difficultSections'] = [];
  if (difficultyScore > 50) {
    difficultSections.push({
      measureStart: 1, measureEnd: 8, type: 'harmony',
      description: '引子部分，注意各声部进入时机',
      voiceParts, severity: 'medium',
    });
  }

  return { id: scoreId, title, difficulty, difficultyScore, key, timeSignature, tempo, difficultSections, analyzedAt: new Date().toISOString() };
}
