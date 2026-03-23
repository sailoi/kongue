import React, { useRef, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Pressable,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { VOICE_CHAT_URL, VOICE_CHAT_INTRO_URL, TRANSLATE_URL } from '@/constants/api';
import { getAuthToken } from '@/utils/firebase';

export type ChatMode = 'lesson' | 'freeform';
type Status = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Message {
  role: 'user' | 'ai';
  text: string;
  translation?: string;
  audio?: string; // base64 mp3, cached for replay
}

interface LessonContext {
  lessonTitle: string;
  lessonLines: string[];
}

interface FreeformContext {
  categoryName: string;
  dialogueLines: string[];
}

interface VoiceChatModalProps {
  visible: boolean;
  mode: ChatMode;
  onClose: () => void;
  language: string;
  userName?: string;
  lessonContext?: LessonContext;
  freeformContext?: FreeformContext;
}

const MAX_DURATION = 15; // seconds
const MAX_TURNS_LESSON = 5;
const MAX_TURNS_FREEFORM = 10;


const STATUS_LABEL: Record<Status, string> = {
  idle: 'Hold to speak',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
};

const PLACEHOLDER_MESSAGES: Record<ChatMode, Message[]> = {
  lesson: [
    { role: 'ai', text: "Hola! I'm here to help you practice this lesson. What would you like to work on?" },
  ],
  freeform: [
    { role: 'ai', text: "Hola! Let's have a real conversation using everything you've learned." },
  ],
};

export const VoiceChatModal: React.FC<VoiceChatModalProps> = ({
  visible,
  mode,
  onClose,
  language,
  userName,
  lessonContext,
  freeformContext,
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const maxTurns = mode === 'freeform' ? MAX_TURNS_FREEFORM : MAX_TURNS_LESSON;

  const [status, setStatus] = React.useState<Status>('idle');
  const [messages, setMessages] = React.useState<Message[]>(PLACEHOLDER_MESSAGES[mode]);
  const [timeLeft, setTimeLeft] = React.useState(MAX_DURATION);
  const [turnCount, setTurnCount] = React.useState(0);
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = React.useState(1.0);

  const SPEED_STEPS = [0.8, 0.9, 1.0];
  const cycleSpeed = () => {
    setPlaybackRate(prev => {
      const idx = SPEED_STEPS.indexOf(prev);
      return SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    });
  };
  const [translatingIndex, setTranslatingIndex] = React.useState<number | null>(null);
  const [showHint, setShowHint] = React.useState(false);
  const hintOpacity = useRef(new Animated.Value(0)).current;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Reset state and fetch AI intro when modal opens
  useEffect(() => {
    if (visible) {
      setStatus('thinking');
      setMessages([]);
      setTimeLeft(MAX_DURATION);
      setTurnCount(0);
      setExpandedIndex(null);
      setShowHint(false);
      hintOpacity.setValue(0);
      progressAnim.setValue(0);
      Audio.requestPermissionsAsync();
      fetchIntro();
    } else {
      // Cleanup on close
      stopRecording();
      soundRef.current?.unloadAsync();
    }
  }, [visible, mode]);

  // Pulse animation while listening
  useEffect(() => {
    if (status === 'listening') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status]);

  // Auto-stop when countdown reaches zero
  useEffect(() => {
    if (timeLeft === 0 && status === 'listening') {
      stopRecording();
    }
  }, [timeLeft, status]);

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const fetchIntro = async () => {
    try {
      const baseCtx = mode === 'lesson' ? (lessonContext ?? {}) : (freeformContext ?? {});
      const ctx = JSON.stringify({ ...baseCtx, userName });

      const token = await getAuthToken();
      const formData = new FormData();
      formData.append('language', language);
      formData.append('mode', mode);
      formData.append('context', ctx);

      const response = await fetch(VOICE_CHAT_INTRO_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();
      setMessages([{ role: 'ai', text: data.response, audio: data.audio }]);
      setStatus('speaking');
      await playBase64Audio(data.audio);
      setStatus('idle');
      setShowHint(true);
      Animated.sequence([
        Animated.timing(hintOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.delay(5000),
        Animated.timing(hintOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start(() => setShowHint(false));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Intro fetch error:', msg);
      setMessages([{ role: 'ai', text: `Error starting conversation: ${msg}` }]);
      setStatus('idle');
    }
  };

  const startRecording = async () => {
    try {
      const { granted } = await Audio.getPermissionsAsync();
      if (!granted) {
        setMessages(prev => [...prev, { role: 'ai', text: 'Microphone permission is required. Please enable it in your device settings.' }]);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;

      setTimeLeft(MAX_DURATION);
      progressAnim.setValue(0);

      Animated.timing(progressAnim, {
        toValue: 1,
        duration: MAX_DURATION * 1000,
        useNativeDriver: false,
      }).start();

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);

      setStatus('listening');
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    setTimeLeft(MAX_DURATION);

    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (err) {
      console.error('Failed to stop recording:', err);
      return;
    }

    const uri = recording.getURI();
    if (!uri) return;

    setStatus('thinking');
    await callVoiceChatAPI(uri);
  };

  const callVoiceChatAPI = async (audioUri: string) => {
    try {
      const baseCtx = mode === 'lesson' ? (lessonContext ?? {}) : (freeformContext ?? {});
      const history = messages
        .filter(m => m.text && !m.text.startsWith("That's our"))
        .map(m => ({ role: m.role, text: m.text }));
      const ctx = JSON.stringify({ ...baseCtx, userName, history });

      console.log('[VoiceChat] audioUri:', audioUri);
      console.log('[VoiceChat] language:', language, 'mode:', mode);

      // Log file info
      const { getInfoAsync } = await import('expo-file-system/legacy');
      const fileInfo = await getInfoAsync(audioUri);
      console.log('[VoiceChat] fileInfo:', JSON.stringify(fileInfo));

      const token = await getAuthToken();
      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);
      formData.append('language', language);
      formData.append('mode', mode);
      formData.append('context', ctx);
      console.log('[VoiceChat] sending request to', VOICE_CHAT_URL);

      const response = await fetch(VOICE_CHAT_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error: ${response.status}`);
      }

      const data = await response.json();
      const { transcript, response: aiText, audio: audioBase64 } = data;

      setMessages(prev => [...prev, { role: 'user', text: transcript }]);

      const nextTurn = turnCount + 1;
      setTurnCount(nextTurn);
      setMessages(prev => [
        ...prev,
        { role: 'ai' as const, text: aiText, audio: audioBase64 },
        ...(nextTurn >= maxTurns
          ? [{ role: 'ai' as const, text: `That's our ${maxTurns} exchanges for this session! Close and reopen to start a new conversation.` }]
          : []),
      ]);
      setStatus('speaking');
      await playBase64Audio(audioBase64);
      setStatus('idle');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Voice chat API error:', msg);
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${msg}` }]);
      setStatus('idle');
    }
  };

  const playBase64Audio = async (base64: string) => {
    try {
      soundRef.current?.unloadAsync();
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp3;base64,${base64}` }
      );
      soundRef.current = sound;
      await sound.setRateAsync(playbackRate, true);
      await sound.playAsync();
      await new Promise<void>((resolve) => {
        sound.setOnPlaybackStatusUpdate((s) => {
          if (s.isLoaded && 'didJustFinish' in s && s.didJustFinish) {
            resolve();
          }
        });
      });
    } catch (err) {
      console.error('Failed to play audio response:', err);
    }
  };

  const handleLongPress = async (i: number) => {
    // Toggle off if already expanded
    if (expandedIndex === i) {
      setExpandedIndex(null);
      return;
    }
    setExpandedIndex(i);
    // Already cached
    if (messages[i].translation) return;
    // Fetch translation
    setTranslatingIndex(i);
    try {
      const token = await getAuthToken();
      const response = await fetch(TRANSLATE_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: messages[i].text }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setMessages(prev => prev.map((m, idx) =>
        idx === i ? { ...m, translation: data.translation } : m
      ));
    } catch {
      setMessages(prev => prev.map((m, idx) =>
        idx === i ? { ...m, translation: 'Translation unavailable.' } : m
      ));
    } finally {
      setTranslatingIndex(null);
    }
  };

  const handlePressIn = () => {
    if (status !== 'idle') return;
    startRecording();
  };

  const handlePressOut = () => {
    if (status !== 'listening') return;
    stopRecording();
  };

  const isLimitReached = turnCount >= maxTurns;
  const isDisabled = status === 'thinking' || status === 'speaking' || isLimitReached;
  const isWarning = timeLeft <= 5 && status === 'listening';
  const micColor = status === 'listening'
    ? '#E53E3E'
    : isDisabled ? '#999' : colors.tint;
  const progressColor = '#E53E3E';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>
            {mode === 'lesson' ? 'AI Tutor' : 'Real World Chat'}
          </ThemedText>
          <TouchableOpacity onPress={cycleSpeed} style={styles.speedButton}>
            <ThemedText style={styles.speedButtonText}>{playbackRate}x</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Transcript */}
        <ScrollView
          ref={scrollRef}
          style={styles.transcript}
          contentContainerStyle={styles.transcriptContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              onLongPress={msg.role === 'ai' ? () => handleLongPress(i) : undefined}
              style={[
                styles.bubble,
                msg.role === 'user' ? styles.userBubble : styles.aiBubble,
                { backgroundColor: msg.role === 'user' ? colors.tint : colorScheme === 'dark' ? '#2D2D2D' : '#F0F0F0' },
              ]}
            >
              <View style={styles.bubbleRow}>
                <ThemedText style={[
                  styles.bubbleText,
                  msg.role === 'user' && styles.userBubbleText,
                ]}>
                  {msg.text}
                </ThemedText>
                {msg.role === 'ai' && msg.audio && (
                  <TouchableOpacity
                    onPress={() => playBase64Audio(msg.audio!)}
                    style={styles.replayButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="volume-medium-outline" size={16} color="#888" />
                  </TouchableOpacity>
                )}
              </View>
              {expandedIndex === i && (
                translatingIndex === i
                  ? <ThemedText style={[styles.translationText, msg.role === 'user' && styles.userTranslationText]}>Translating...</ThemedText>
                  : msg.translation
                    ? <ThemedText style={[styles.translationText, msg.role === 'user' && styles.userTranslationText]}>{msg.translation}</ThemedText>
                    : null
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Long-press hint */}
        {showHint && (
          <Animated.View style={[styles.hintBanner, { opacity: hintOpacity }]}>
            <ThemedText style={styles.hintText}>Long press any message to see the English translation</ThemedText>
          </Animated.View>
        )}

        {/* Status + Mic */}
        <View style={styles.controls}>
          <ThemedText style={[styles.statusLabel, isWarning && styles.warningText]}>
            {status === 'listening' ? `${timeLeft}s` : STATUS_LABEL[status]}
          </ThemedText>

          {status === 'thinking' && (
            <ThemedText style={styles.thinkingDots}>···</ThemedText>
          )}

          {/* Progress bar — only visible while listening */}
          {status === 'listening' && (
            <View style={styles.progressBarTrack}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: progressColor,
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          )}

          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={isDisabled}
          >
            <Animated.View style={[
              styles.micRing,
              { borderColor: micColor, transform: [{ scale: pulseAnim }], opacity: isDisabled ? 0.4 : 1 },
            ]}>
              <View style={[styles.micButton, { backgroundColor: micColor }]}>
                <Ionicons
                  name={status === 'listening' ? 'stop' : 'mic'}
                  size={36}
                  color="#fff"
                />
              </View>
            </Animated.View>
          </Pressable>
        </View>
      </ThemedView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  closeButton: {
    width: 44,
    alignItems: 'flex-start',
  },
  speedButton: {
    width: 44,
    alignItems: 'flex-end',
  },
  speedButtonText: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  transcript: {
    flex: 1,
  },
  transcriptContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: 16,
    gap: 12,
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userBubbleText: {
    color: '#fff',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  replayButton: {
    marginTop: 2,
  },
  translationText: {
    fontSize: 13,
    fontStyle: 'italic',
    opacity: 0.6,
    marginTop: 6,
  },
  userTranslationText: {
    color: '#fff',
  },
  controls: {
    alignItems: 'center',
    paddingBottom: 56,
    paddingTop: 24,
    gap: 12,
  },
  statusLabel: {
    fontSize: 14,
    opacity: 0.5,
  },
  warningText: {
    opacity: 1,
    color: '#E53E3E',
    fontWeight: '600',
  },
  thinkingDots: {
    fontSize: 28,
    opacity: 0.4,
    letterSpacing: 4,
  },
  progressBarTrack: {
    width: '60%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.2)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  micRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintBanner: {
    marginHorizontal: 24,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
  },
  hintText: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    opacity: 0.7,
  },
});
