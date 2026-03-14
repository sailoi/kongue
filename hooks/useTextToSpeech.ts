import { useState, useEffect } from 'react';
import { documentDirectory, getInfoAsync, makeDirectoryAsync, downloadAsync } from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { API_KEY, API_URL } from '@/constants/api';

// Custom hook for text-to-speech
const useTextToSpeech = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const playSpeech = async (text: string, gender: 'male' | 'female', language: string = 'spanish') => {
    if (isPlaying) {
      await sound?.stopAsync();
      setIsPlaying(false);
    }

    // Clear any previous errors
    setError(null);

    try {
      const docDir = documentDirectory;
      if (!docDir) {
        throw new Error('FileSystem.documentDirectory is not available.');
      }
      const audioCacheDir = `${docDir}audio/${language}/`;

      // Ensure directory exists
      const dirInfo = await getInfoAsync(audioCacheDir);
      if (!dirInfo.exists) {
        await makeDirectoryAsync(audioCacheDir, { intermediates: true });
      }

      const filename = `${text.replace(/[^a-zA-Z0-9]/g, '_')}_${gender}.mp3`;
      const localUri = audioCacheDir + filename;
      const fileInfo = await getInfoAsync(localUri);

      let soundObject: Audio.Sound;

      if (fileInfo.exists) {
        // Play from cache (no loading needed)
        const { sound } = await Audio.Sound.createAsync({ uri: localUri });
        soundObject = sound;
      } else {
        // Fetch from API - show loading
        setIsLoading(true);
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': API_KEY,
          },
          body: JSON.stringify({ text, gender, language }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.detail || `Server error: ${response.status}`;
          throw new Error(errorMessage);
        }

        const { audioUrl } = await response.json();

        // Download and cache the audio
        await downloadAsync(audioUrl, localUri);
        setIsLoading(false);

        const { sound } = await Audio.Sound.createAsync({ uri: localUri });
        soundObject = sound;
      }

      setSound(soundObject);
      setIsPlaying(true);
      soundObject.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && 'didJustFinish' in status && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
      await soundObject.playAsync();

    } catch (error) {
      console.error('Error fetching or playing audio:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unable to play audio. Please try again.';
      setError(errorMessage);
      setIsPlaying(false);
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return { playSpeech, isPlaying, isLoading, error, clearError };
};

export default useTextToSpeech;
