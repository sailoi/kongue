import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { conversationData } from '@/constants/conversations';

interface Dialogue {
  speaker: string;
  gender: 'male' | 'female';
  spanish?: string;
  turkish?: string;
  english: string;
}

interface VocabularyItem {
  spanish?: string;
  turkish?: string;
  english: string;
}

export interface Conversation {
  title: string;
  description: string;
  dialogue: Dialogue[];
  vocabulary?: VocabularyItem[];
}

const useDailyConversations = (
  language: keyof typeof conversationData,
  category: keyof typeof conversationData[typeof language],
  onProgressUpdate?: (maxIndex: number) => void,
) => {
  const [conversationIndex, setConversationIndex] = useState(0);
  const [maxIndex, setMaxIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const conversations = conversationData[language][category];
  const LESSON_INDEX_KEY = `lessonIndex_${language}_${category}`;
  const MAX_INDEX_KEY = `maxLessonIndex_${language}_${category}`;

  useEffect(() => {
    const loadIndex = async () => {
      setIsLoading(true);
      try {
        const [storedIndex, storedMax] = await Promise.all([
          AsyncStorage.getItem(LESSON_INDEX_KEY),
          AsyncStorage.getItem(MAX_INDEX_KEY),
        ]);
        const index = storedIndex !== null ? parseInt(storedIndex, 10) : 0;
        const max = storedMax !== null ? parseInt(storedMax, 10) : 0;
        setConversationIndex(index < conversations.length ? index : 0);
        setMaxIndex(max < conversations.length ? max : 0);
      } catch (error) {
        console.error('Failed to load lesson index.', error);
        setConversationIndex(0);
        setMaxIndex(0);
      } finally {
        setIsLoading(false);
      }
    };
    loadIndex();
  }, [language, category, conversations.length, LESSON_INDEX_KEY, MAX_INDEX_KEY]);

  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(LESSON_INDEX_KEY, conversationIndex.toString());
      if (conversationIndex > maxIndex) {
        setMaxIndex(conversationIndex);
        AsyncStorage.setItem(MAX_INDEX_KEY, conversationIndex.toString());
        onProgressUpdate?.(conversationIndex);
      }
    }
  }, [conversationIndex, isLoading, LESSON_INDEX_KEY, MAX_INDEX_KEY]);

  const nextConversation = useCallback(() => {
    setConversationIndex((prevIndex) => (prevIndex + 1) % conversations.length);
  }, [conversations.length]);

  const previousConversation = useCallback(() => {
    setConversationIndex((prevIndex) => (prevIndex - 1 + conversations.length) % conversations.length);
  }, [conversations.length]);

  const setLesson = (index: number) => {
    if (index >= 0 && index < conversations.length) {
      setConversationIndex(index);
    }
  };

  return {
    conversation: conversations[conversationIndex],
    nextConversation,
    previousConversation,
    currentIndex: conversationIndex,
    setConversationIndex: setLesson,
    isLoading,
    totalLessons: conversations.length,
    completedLessons: maxIndex + 1,
  };
};

export default useDailyConversations;
