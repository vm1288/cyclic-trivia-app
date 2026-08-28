import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import GlowDivider from './GlowDivider';

/**
 * Cyclic — Trivia Question screen.
 * Shown full-screen, device in LANDSCAPE, when a question goes live during a turn.
 *
 * Deps: expo-linear-gradient, react-native-svg, react-native-safe-area-context
 *   npx expo install expo-linear-gradient react-native-svg react-native-safe-area-context
 * Fonts (expo-font / @expo-google-fonts): Saira 400/600/700, Saira Condensed 700
 *
 * Layout notes (carried over from the reviewed mockup):
 * - The question card only occupies the middle 70% of the screen width
 *   (see CONTENT_WIDTH_PCT below) — the outer 30% is left as plain background.
 * - "QUESTION N" sits directly above the question text (not in the top bar),
 *   with an optional category/subcategory line next to it.
 * - The web mockup cut the corners off the small tags with CSS `clip-path`.
 *   React Native has no clip-path equivalent, so those are simplified to
 *   rounded-rect chips here — consistent with how the rest of the app's
 *   chips/buttons (Pause Game, score chips, etc.) are already built.
 * - The countdown is live: it ticks down every second and turns red/urgent
 *   in the last 5 seconds.
 */

// Percentage of the landscape screen width the whole question card uses.
const CONTENT_WIDTH_PCT = '70%';

// Answers A–D reuse the exact 4 accent colors already used for the
// Joker / Skipper / Eliminator / Changer help cards elsewhere in the app,
// so a 4th option stays visually consistent with the rest of Cyclic.
const ANSWER_COLORS = ['#c86bff', '#7fc0ff', '#f9b23f', '#ff7fb8'];
const ANSWER_TINTS = ['rgba(52,18,96,0.55)', 'rgba(12,44,100,0.5)', 'rgba(84,48,4,0.5)', 'rgba(88,12,52,0.5)'];

const C = {
  cyan: '#5fe6ff',
  purple: '#c86bff',
  violet: '#8b5cf6',
  red: '#ff3b4e',
  dim: 'rgba(198,212,240,0.72)',
};

// Same iOS-shadow / Android-elevation glow helper used across the app's other screens.
const glow = (color: string, opacity = 0.35, radius = 14) =>
  Platform.select({
    ios: { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: 0 } },
    android: { elevation: opacity > 0.3 ? 9 : 4 },
    default: {},
  }) as object;

const ClockIcon = ({ color }: { color: string }) => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
    <Circle cx={12} cy={13} r={8} />
    <Path d="M12 9.5v4" />
    <Path d="M9.5 3.5h5" />
  </Svg>
);

const ArrowIcon = () => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill="#fff">
    <Path d="M5 3.5l16 8.5-16 8.5z" />
  </Svg>
);

export interface QuestionAnswer {
  /** Letter shown in the round badge, e.g. "A". Also used as the React key. */
  label: string;
  text: string;
}

export interface QuestionScreenProps {
  questionNumber?: number;
  /** Main category, shown as a dim label next to the "QUESTION N" tag, e.g. "Football" */
  category?: string;
  /** Optional subcategory appended after category, e.g. "World Cup 2026" → renders "FOOTBALL · WORLD CUP 2026" */
  subcategory?: string;
  questionText: string;
  /** 3 or 4 answers. Colors/order are fixed by index — see ANSWER_COLORS. */
  answers: QuestionAnswer[];
  /** Countdown length in seconds. Default 20. */
  timerSeconds?: number;
  /** Called with the selected answer's label (or null) when SUBMIT is pressed. */
  onSubmit?: (selectedLabel: string | null) => void;
}

export default function QuestionScreen({
  questionNumber = 1,
  category,
  subcategory,
  questionText,
  answers,
  timerSeconds = 20,
  onSubmit,
}: QuestionScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(timerSeconds);
  const [selected, setSelected] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live countdown: ticks every second, holds at 0 (does not go negative).
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecondsLeft(sec => (sec > 0 ? sec - 1 : 0));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const urgent = secondsLeft <= 5;
  const timerLabel = `00:${String(secondsLeft).padStart(2, '0')}`;
  const categoryLabel = [category, subcategory].filter(Boolean).join(' · ').toUpperCase();

  return (
    <View style={s.root}>
      <LinearGradient colors={['#0d1030', '#06061a', '#03030c']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={s.safe} edges={['top', 'bottom', 'left', 'right']}>
        {/* content column pinned to 70% width, centered */}
        <View style={s.content}>

          {/* ── top bar: BREAKING NEWS tag — glow rule — timer — submit ── */}
          <View style={s.topBar}>
            <View style={[s.newsTag, glow(C.cyan, 0.28, 12)]}>
              <Text style={s.newsTagText}>BREAKING NEWS</Text>
            </View>

            <GlowDivider color="#1f6fd6" accent={C.cyan} height={1.5} flareWidth={70} style={s.rule} />

            <View style={[s.timerTag, urgent && s.timerTagUrgent, glow(urgent ? C.red : C.purple, 0.3, 12)]}>
              <ClockIcon color={urgent ? '#ff6b78' : C.purple} />
              <Text style={[s.timerText, urgent && s.timerTextUrgent]}>{timerLabel}</Text>
            </View>

            <Pressable
              onPress={() => onSubmit?.(selected)}
              style={({ pressed }) => [s.submitBtn, glow(C.violet, 0.45, 14), pressed && s.pressedShrink]}
            >
              <Text style={s.submitText}>SUBMIT</Text>
              <ArrowIcon />
            </Pressable>
          </View>

          {/* ── main row: question column — divider — answers column ── */}
          <View style={s.mainRow}>

            {/* left: "QUESTION N" tag sits ABOVE the question text, per spec */}
            <View style={s.questionCol}>
              <View style={s.questionTagRow}>
                <View style={s.questionTag}>
                  <Text style={s.questionTagText}>QUESTION {questionNumber}</Text>
                </View>
                {categoryLabel ? <Text style={s.categoryText}>{categoryLabel}</Text> : null}
              </View>
              <Text style={s.questionText}>{questionText}</Text>
            </View>

            <View style={s.divider} />

            {/* right: up to 4 answers, tap to select, SUBMIT above locks it in */}
            <View style={s.answersCol}>
              {answers.map((a, i) => {
                const color = ANSWER_COLORS[i % ANSWER_COLORS.length];
                const tint = ANSWER_TINTS[i % ANSWER_TINTS.length];
                const isSelected = selected === a.label;
                return (
                  <Pressable
                    key={a.label}
                    onPress={() => setSelected(a.label)}
                    style={({ pressed }) => [
                      s.optionBtn,
                      { borderColor: isSelected ? color : `${color}8c` },
                      isSelected && glow(color, 0.5, 16),
                      pressed && s.pressedShrinkSm,
                    ]}
                  >
                    <LinearGradient colors={[tint, 'rgba(9,11,28,0.75)']} style={StyleSheet.absoluteFillObject} />
                    <View style={[s.optionBadge, { borderColor: color }]}>
                      <Text style={[s.optionBadgeText, { color }]}>{a.label}</Text>
                    </View>
                    <Text style={s.optionText} numberOfLines={1}>{a.text}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04040e' },
  safe: { flex: 1 },
  content: { flex: 1, width: CONTENT_WIDTH_PCT, alignSelf: 'center', paddingVertical: 14, gap: 12 },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  newsTag: {
    height: 28, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center',
    borderWidth: 1.3, borderColor: 'rgba(95,230,255,0.55)', backgroundColor: 'rgba(8,26,34,0.9)',
  },
  newsTagText: { fontFamily: 'SairaCondensed_700Bold', fontSize: 11, letterSpacing: 1.5, color: C.cyan },
  rule: { flex: 1 },
  timerTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 12, borderRadius: 8,
    borderWidth: 1.3, borderColor: 'rgba(200,107,255,0.55)', backgroundColor: 'rgba(52,18,96,0.85)',
  },
  timerTagUrgent: { borderColor: 'rgba(255,59,78,0.6)', backgroundColor: 'rgba(70,8,20,0.85)' },
  timerText: { fontFamily: 'Saira_700Bold', fontSize: 13, color: C.purple },
  timerTextUrgent: { color: '#ff6b78' },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 28, paddingHorizontal: 16, borderRadius: 8,
    borderWidth: 1.4, borderColor: C.violet, backgroundColor: 'rgba(51,25,94,0.95)',
  },
  submitText: { fontFamily: 'Saira_700Bold', fontSize: 12, letterSpacing: 1, color: '#fff' },
  pressedShrink: { transform: [{ scale: 0.96 }] },
  pressedShrinkSm: { transform: [{ scale: 0.98 }] },

  mainRow: { flex: 1, flexDirection: 'row', alignItems: 'stretch', gap: 20 },

  questionCol: { flex: 1.05, justifyContent: 'center', gap: 9 },
  questionTagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  questionTag: {
    height: 24, paddingHorizontal: 12, borderRadius: 6, justifyContent: 'center',
    borderWidth: 1.2, borderColor: 'rgba(127,192,255,0.5)', backgroundColor: 'rgba(10,13,34,0.85)',
  },
  questionTagText: { fontFamily: 'SairaCondensed_700Bold', fontSize: 10.5, letterSpacing: 1.3, color: '#fff' },
  categoryText: { fontFamily: 'Saira_600SemiBold', fontSize: 10.5, letterSpacing: 0.4, color: C.dim },
  questionText: { fontFamily: 'Saira_400Regular', fontSize: 15, lineHeight: 21, color: '#eaf1ff' },

  divider: { width: 1, backgroundColor: 'rgba(110,140,210,0.5)' },

  answersCol: { flex: 1, justifyContent: 'center', gap: 8 },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1.4, overflow: 'hidden',
  },
  optionBadge: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.4,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,11,28,0.6)',
  },
  optionBadgeText: { fontFamily: 'Saira_700Bold', fontSize: 13 },
  optionText: { flex: 1, fontFamily: 'Saira_600SemiBold', fontSize: 13.5, color: '#eaf1ff' },
});
