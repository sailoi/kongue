import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { conversationData } from '@/constants/conversations';
import { CATEGORIES, STAGES } from '@/constants/categories';

export interface CategoryProgress {
  completed: number;
  total: number;
}

export interface StageProgress {
  completed: number;
  total: number;
  allDone: boolean;
}

const useProgress = (language: string, refreshKey?: number) => {
  const [categoryProgress, setCategoryProgress] = useState<Record<string, CategoryProgress>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const data = conversationData[language as keyof typeof conversationData];
      if (!data) { setIsLoading(false); return; }

      const progress: Record<string, CategoryProgress> = {};
      await Promise.all(
        CATEGORIES.map(async (cat) => {
          const lessons = data[cat.id as keyof typeof data] as unknown[];
          if (!lessons) return;
          const total = lessons.length;
          const stored = await AsyncStorage.getItem(`maxLessonIndex_${language}_${cat.id}`);
          const maxIndex = stored !== null ? parseInt(stored, 10) : 0;
          progress[cat.id] = { completed: Math.min(maxIndex + 1, total), total };
        })
      );

      setCategoryProgress(progress);
      setIsLoading(false);
    };
    load();
  }, [language, refreshKey]);

  const stageProgress: Record<string, StageProgress> = {};
  for (const stage of STAGES) {
    const stageCats = CATEGORIES.filter(c => c.stage === stage.id);
    const completed = stageCats.reduce((sum, c) => sum + (categoryProgress[c.id]?.completed ?? 0), 0);
    const total = stageCats.reduce((sum, c) => sum + (categoryProgress[c.id]?.total ?? 0), 0);
    stageProgress[stage.id] = { completed, total, allDone: total > 0 && completed >= total };
  }

  return { categoryProgress, stageProgress, isLoading };
};

export default useProgress;
