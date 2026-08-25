import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * GlowDivider — thin neon rule with a bright bloom at the centre.
 * Deps: expo-linear-gradient
 *
 *   <GlowDivider />
 *   <GlowDivider color="#4b2fd6" accent="#d9c2ff" height={2} />
 */

type Props = {
  /** Colour of the rule itself */
  color?: string;
  /** Colour of the centre flare */
  accent?: string;
  /** Rule thickness in px */
  height?: number;
  /** Width of the centre bloom in px */
  flareWidth?: number;
  style?: ViewStyle;
};

export default function GlowDivider({
  color = '#1f6fd6',
  accent = '#c2e6ff',
  height = 1.5,
  flareWidth = 130,
  style,
}: Props) {
  return (
    <View style={[styles.root, style]}>
      {/* wide, very soft haze behind everything */}
      <LinearGradient
        colors={['transparent', 'rgba(31,111,214,0.30)', 'rgba(80,160,255,0.50)', 'rgba(31,111,214,0.30)', 'transparent']}
        locations={[0, 0.3, 0.5, 0.7, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.haze, { height: height * 12 }]}
        pointerEvents="none"
      />

      {/* the rule — fades out at both ends */}
      <LinearGradient
        colors={['transparent', color, accent, color, 'transparent']}
        locations={[0, 0.18, 0.5, 0.82, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ height, borderRadius: height }}
      />

      {/* centre flare: horizontal streak only */}
      <View style={[styles.flareWrap, { width: flareWidth }]} pointerEvents="none">
        <LinearGradient
          colors={['transparent', accent, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: '100%', height: height * 2, borderRadius: height }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', justifyContent: 'center' },
  haze: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignSelf: 'center',
    opacity: 0.55,
  },
  flareWrap: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
