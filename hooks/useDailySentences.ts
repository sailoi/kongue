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

export interface Conversation {
  title: string;
  description: string;
  dialogue: Dialogue[];
}

const useDailyConversations = (
  language: keyof typeof conversationData,
  category: keyof typeof conversationData[typeof language]
) => {
  const [conversationIndex, setConversationIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const conversations = conversationData[language][category];
  const LESSON_INDEX_KEY = `lessonIndex_${language}_${category}`;

  useEffect(() => {
    const loadIndex = async () => {
      setIsLoading(true);
      try {
        const storedIndex = await AsyncStorage.getItem(LESSON_INDEX_KEY);
        if (storedIndex !== null) {
          const index = parseInt(storedIndex, 10);
          if (index < conversations.length) {
            setConversationIndex(index);
          } else {
            setConversationIndex(0);
          }
        } else {
          setConversationIndex(0);
        }
      } catch (error) {
        console.error('Failed to load lesson index.', error);
        setConversationIndex(0);
      } finally {
        setIsLoading(false);
      }
    };
    loadIndex();
  }, [language, category, conversations.length, LESSON_INDEX_KEY]);

  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(LESSON_INDEX_KEY, conversationIndex.toString());
    }
  }, [conversationIndex, isLoading, LESSON_INDEX_KEY]);

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
  };
};

export default useDailyConversations;
