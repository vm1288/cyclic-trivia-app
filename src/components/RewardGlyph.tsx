import { createContext, useContext } from 'react';
import { Image, Text, View } from 'react-native';

/**
 * Biểu tượng "sao" của ván - theo bộ bàn cờ (Tony 21/9): CricTriv dùng QUẢ BÓNG CRICKET (đúng như bàn cờ
 * web `MainBoard.js`: `<img src="/images/cricket-ball1.png" class="ball filled">`), bàn khác dùng ★.
 *
 * Mọi chỗ vẽ sao (dải người chơi, ô mình, tấm kết quả, sao bay, tấm nhận thẻ) đi qua đây - đừng gõ ★ thẳng.
 * `game-landscape` cấp `RewardContext` theo `boardGameId`; ngoài ván (không có provider) mặc định ★.
 */
export type RewardKind = 'star' | 'ball';
export const RewardContext = createContext<RewardKind>('star');
export const rewardKindFor = (boardGameId: string): RewardKind => (boardGameId === 'crictriv' ? 'ball' : 'star');
export const useRewardKind = () => useContext(RewardContext);

const BALL = require('../../assets/cricket-ball.png');

/**
 * Một sao / bóng. `size` = cỡ chữ của ★ (bóng vẽ cao bằng `size * 1.1` cho cân mắt).
 * `filled=false` = ô trống: ★ xám nhạt, bóng thì mờ đi (như `.ball.empty` của web).
 */
export function RewardGlyph({
  size = 10,
  filled = true,
  color = '#FFD23F',
  glow = false,
}: {
  size?: number;
  filled?: boolean;
  color?: string;
  glow?: boolean;
}) {
  const kind = useRewardKind();
  if (kind === 'ball') {
    const px = Math.round(size * 1.1);
    return (
      <View
        style={[
          { width: px, height: Math.round(size * 1.45), justifyContent: 'center', alignItems: 'center' },
          glow ? { borderRadius: px, boxShadow: '0 0 14px rgba(255,90,60,0.9)' } : null,
        ]}
      >
        <Image source={BALL} style={{ width: px, height: px, opacity: filled ? 1 : 0.28 }} resizeMode="contain" />
      </View>
    );
  }
  return (
    <Text
      style={[
        {
          fontSize: size,
          /* 1.45: glyph ★ thò xuống dưới đường cơ sở, lineHeight sát quá là cụt chân (đo ở ô người chơi). */
          lineHeight: size * 1.45,
          color: filled ? color : 'rgba(200,215,255,0.30)',
        },
        glow ? { textShadowColor: 'rgba(255,210,63,0.9)', textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 } } : null,
      ]}
    >
      ★
    </Text>
  );
}
