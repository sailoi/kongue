import { USER_URL } from '@/constants/api';
import { getAuthToken } from '@/utils/firebase';

export async function syncUserProfile(userId: string, name: string, language: string): Promise<void> {
  try {
    const token = await getAuthToken();
    await fetch(USER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ user_id: userId, name, language }),
    });
  } catch (e) {
    console.warn('Failed to sync user profile:', e);
  }
}

export async function syncLessonProgress(
  userId: string,
  language: string,
  category: string,
  maxIndex: number,
): Promise<void> {
  try {
    const token = await getAuthToken();
    await fetch(`${USER_URL}/${userId}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ language, category, max_index: maxIndex }),
    });
  } catch (e) {
    console.warn('Failed to sync progress:', e);
  }
}

export interface CloudUserData {
  exists: boolean;
  profile?: { name: string; language: string };
  progress?: Record<string, { language: string; category: string; maxIndex: number }>;
}

export async function loadUserFromCloud(userId: string): Promise<CloudUserData | null> {
  try {
    const token = await getAuthToken();
    const res = await fetch(`${USER_URL}/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await res.json();
  } catch (e) {
    console.warn('Failed to load user from cloud:', e);
    return null;
  }
}
