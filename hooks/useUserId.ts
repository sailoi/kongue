import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns a stable device-scoped user ID, creating one on first launch.
 * This ID is used to sync progress and profile to Firestore.
 */
const useUserId = (): string | null => {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('userId').then((stored) => {
      if (stored) {
        setUserId(stored);
      } else {
        const newId = generateUUID();
        AsyncStorage.setItem('userId', newId);
        setUserId(newId);
      }
    });
  }, []);

  return userId;
};

export default useUserId;
