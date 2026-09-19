import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { assetUrl } from '../src/api/game';
import { fetchStoreGames, type StoreGame } from '../src/api/store';
import { StageBackground } from '../src/components/StageBackground';
import { useT } from '../src/i18n/I18nProvider';
import type { TranslationKey } from '../src/i18n/translations';
import { bg, innerGlow, neon, outerGlow, text } from '../src/theme/colors';

/**
 * HOW TO PLAY - chép `Views/Public/GameInstruction.cshtml` của bản web (12 trang
 * lật Back/Next), rồi nối thêm 9 trang cho những gì web không nhắc mà app đã có
 * (chọn hướng, Your Choice, battle, 10-sec, Give It Up, curve ball, nút cột phải,
 * Leaderboard Challenge, vào lại ván). Tony duyệt theo bản phác 2026-09-12.
 *
 * Khác web: KHÔNG có nút Skip và không gọi `/public/skipInstruction` - web chiếu
 * màn này ngay sau khi tạo ván (`GameSetup.Instruction`), còn app mở từ Home,
 * không có ván nào để bỏ qua. Trang cuối là DONE về Home.
 *
 * Bố cục: trang cuộn ngang `pagingEnabled` (vuốt được), nút BACK / NEXT chỉ
 * cuộn tới trang kế; chấm tiến độ đọc từ vị trí cuộn. Mỗi trang là hình bên trái
 * + chữ bên phải, cùng khuôn hai cột của mọi màn ngang khác.
 */

type Art =
  | 'dice'
  | 'points'
  | 'buzzer'
  | 'board'
  | 'categories'
  | 'cards'
  | 'cardsMax'
  | 'joker'
  | 'changer'
  | 'eliminator'
  | 'skipper'
  | 'stars'
  | 'arrows'
  | 'yourChoice'
  | 'battle'
  | 'timer'
  | 'giveItUp'
  | 'curveball'
  | 'buttons'
  | 'trophy'
  | 'resume';

/**
 * K113 (Tony 19/9, ảnh mẫu): HOW TO PLAY = trang chọn mục **GAME INSTRUCTIONS** (General Instructions
 * · Trivia games · Cyclic Career) rồi từng mục là pager. Trang kiểu mới: chữ bên TRÁI (tiêu đề +
 * đoạn, `**đậm**`, `• ` gạch đầu dòng), ảnh chụp app / ô chờ ảnh bên PHẢI. Các trang cũ (chép web,
 * 09-12) giữ nguyên khuôn art-trái / chữ-phải và nối sau ba trang Trivia mới.
 */
type Page = {
  eyebrow: TranslationKey;
  lines: TranslationKey[];
  art: Art | 'photo' | 'placeholder';
  strong?: number;
  /** Tiêu đề trang kiểu mới ("Host a Game"). */
  heading?: TranslationKey;
  /** `art: 'photo'` → ảnh này; `art: 'placeholder'` → ô chữ `placeholder`. */
  photo?: number;
  placeholder?: TranslationKey;
};

const PHOTO = {
  lobby: require('../assets/howto/lobby.jpg'),
  join: require('../assets/howto/join.jpg'),
  question: require('../assets/howto/question.jpg'),
  cards: require('../assets/howto/cards.jpg'),
} as const;

const GENERAL_PAGES: Page[] = [
  { eyebrow: 'howTo.g1', heading: 'howTo.g1', lines: ['howTo.g1a', 'howTo.g1b', 'howTo.g1c'], art: 'photo', photo: PHOTO.lobby },
  { eyebrow: 'howTo.g2', heading: 'howTo.g2', lines: ['howTo.g2a', 'howTo.g2b', 'howTo.g2c', 'howTo.g2d', 'howTo.g2e'], art: 'photo', photo: PHOTO.join },
  { eyebrow: 'howTo.g3', heading: 'howTo.g3', lines: ['howTo.g3a', 'howTo.g3b'], art: 'placeholder', placeholder: 'howTo.g3img' },
];

const TRIVIA_HEAD: Page[] = [
  { eyebrow: 'howTo.t1', heading: 'howTo.t1', lines: ['howTo.t1a', 'howTo.t1b', 'howTo.t1c'], art: 'photo', photo: PHOTO.question },
  { eyebrow: 'howTo.t2', heading: 'howTo.t2', lines: ['howTo.t2a', 'howTo.t2b', 'howTo.t2c'], art: 'placeholder', placeholder: 'howTo.t2img' },
  { eyebrow: 'howTo.t3', heading: 'howTo.t3', lines: ['howTo.t3a', 'howTo.t3b', 'howTo.t3c', 'howTo.t3d', 'howTo.t3e', 'howTo.t3f'], art: 'photo', photo: PHOTO.cards },
];

/**
 * `strong` = chỉ số dòng in đậm vàng (câu chốt của trang). Thứ tự trang và chữ
 * đúng như web, xem ghi chú ở `howTo.*` trong `translations.ts`.
 */
const PAGE_PAD = 20;
const PAGE_GAP = 18;

const PAGES: Page[] = [
  { eyebrow: 'howTo.e1', lines: ['howTo.p1a', 'howTo.p1b'], art: 'dice' },
  { eyebrow: 'howTo.e2', lines: ['howTo.p2a', 'howTo.p2b', 'howTo.p2c', 'howTo.p2d'], art: 'points', strong: 0 },
  { eyebrow: 'howTo.e3', lines: ['howTo.p3a', 'howTo.p3b', 'howTo.p3c'], art: 'buzzer', strong: 1 },
  { eyebrow: 'howTo.e4', lines: ['howTo.p4a', 'howTo.p4b'], art: 'board', strong: 1 },
  { eyebrow: 'howTo.e5', lines: ['howTo.p5a', 'howTo.p5b', 'howTo.p5c'], art: 'categories' },
  { eyebrow: 'howTo.e6', lines: ['howTo.p6a'], art: 'cards', strong: 0 },
  { eyebrow: 'howTo.e7', lines: ['howTo.p7a', 'howTo.p7b'], art: 'joker', strong: 1 },
  { eyebrow: 'howTo.e8', lines: ['howTo.p8a', 'howTo.p8b', 'howTo.p8c'], art: 'changer' },
  { eyebrow: 'howTo.e9', lines: ['howTo.p9a', 'howTo.p9b', 'howTo.p9c', 'howTo.p9d'], art: 'eliminator' },
  { eyebrow: 'howTo.e10', lines: ['howTo.p10a', 'howTo.p10b', 'howTo.p10c', 'howTo.p10d', 'howTo.p10e'], art: 'skipper', strong: 2 },
  { eyebrow: 'howTo.e11', lines: ['howTo.p11a', 'howTo.p11b', 'howTo.p11c', 'howTo.p11d'], art: 'stars', strong: 2 },
  { eyebrow: 'howTo.e12', lines: ['howTo.p12a', 'howTo.p12b', 'howTo.p12c'], art: 'cardsMax' },
  { eyebrow: 'howTo.e13', lines: ['howTo.p13a', 'howTo.p13b', 'howTo.p13c'], art: 'arrows', strong: 2 },
  { eyebrow: 'howTo.e14', lines: ['howTo.p14a', 'howTo.p14b', 'howTo.p14c'], art: 'yourChoice' },
  { eyebrow: 'howTo.e15', lines: ['howTo.p15a', 'howTo.p15b', 'howTo.p15c'], art: 'battle' },
  { eyebrow: 'howTo.e16', lines: ['howTo.p16a', 'howTo.p16b', 'howTo.p16c'], art: 'timer' },
  { eyebrow: 'howTo.e17', lines: ['howTo.p17a', 'howTo.p17b'], art: 'giveItUp', strong: 0 },
  { eyebrow: 'howTo.e18', lines: ['howTo.p18a', 'howTo.p18b', 'howTo.p18c'], art: 'curveball' },
  { eyebrow: 'howTo.e19', lines: ['howTo.p19a', 'howTo.p19b', 'howTo.p19c'], art: 'buttons' },
  { eyebrow: 'howTo.e20', lines: ['howTo.p20a', 'howTo.p20b', 'howTo.p20c'], art: 'trophy' },
  { eyebrow: 'howTo.e21', lines: ['howTo.p21a', 'howTo.p21b'], art: 'resume' },
];

/** Màu bốn thẻ, cùng bộ với nút thẻ ở màn ván (`game-landscape`). */
const CARD = {
  Joker: { rgb: '197,107,255', line: '#C56BFF' },
  Changer: { rgb: '255,79,163', line: '#FF4FA3' },
  Eliminator: { rgb: '255,198,30', line: '#FFC61E' },
  Skipper: { rgb: '58,165,255', line: '#3AA5FF' },
} as const;
type CardName = keyof typeof CARD;

/**
 * Ảnh thẻ lấy từ server như `CurveBallOverlay` - cùng file bản web dùng
 * (`wwwroot/images/cards/*.png`), sponsor đổi ảnh là app đổi theo.
 */
function CardArt({ name, big, badge }: { name: CardName; big?: boolean; badge?: string }) {
  const c = CARD[name];
  return (
    <View
      style={[
        styles.card,
        big && styles.cardBig,
        { borderColor: c.line, boxShadow: `0 0 14px rgba(${c.rgb},0.45), inset 0 0 16px rgba(${c.rgb},0.18)` },
      ]}
    >
      <Image
        source={{ uri: assetUrl(`/images/cards/${name.toLowerCase()}.png`) }}
        style={styles.cardImage}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      {badge ? (
        <View style={[styles.cardBadge, { borderColor: c.line }]}>
          <Text style={[styles.cardBadgeText, { color: c.line }]}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Die({ value, size = 64 }: { value: 3 | 6; size?: number }) {
  const on = value === 3 ? [0, 4, 8] : [0, 2, 3, 5, 6, 8];
  return (
    <View style={[styles.die, { width: size, height: size, borderRadius: size * 0.2, padding: size * 0.14 }]}>
      {Array.from({ length: 9 }, (_, i) => (
        <View key={i} style={styles.pipCell}>
          <View style={[styles.pip, { width: size * 0.16, height: size * 0.16, opacity: on.includes(i) ? 1 : 0 }]} />
        </View>
      ))}
    </View>
  );
}

const SQUARES: { label: string; color: string }[] = [
  { label: 'TEST CRICKET', color: '#1D8ED9' },
  { label: 'IPL', color: '#E6394F' },
  { label: 'ODIs', color: '#2AAB6B' },
  { label: 'RECENT NEWS', color: '#8C4BD8' },
  { label: 'BIG BASH', color: '#F08A24' },
  { label: 'THE HUNDRED', color: '#5B6B7A' },
];

/** Bảng điểm minh hoạ - điểm số y như web (98/96/109/95/110/50), người dẫn đầu sáng. */
const SCORES: { color: string; pt: number }[] = [
  { color: '#FF6A12', pt: 98 },
  { color: '#3AA5FF', pt: 96 },
  { color: '#C56BFF', pt: 109 },
  { color: '#25D366', pt: 110 },
  { color: '#FFC61E', pt: 95 },
];

function PageArt({ art, t }: { art: Art; t: ReturnType<typeof useT> }) {
  switch (art) {
    case 'dice':
      return <Die value={3} size={92} />;
    case 'points':
      return (
        <View style={styles.center}>
          <Text style={[styles.bigNum, { color: neon.green.stroke, textShadowColor: 'rgba(37,211,102,0.6)' }]}>+2</Text>
          <Text style={styles.bigNumLabel}>POINTS</Text>
        </View>
      );
    case 'buzzer':
      return (
        <View style={styles.center}>
          <Text style={[styles.bigNum, { color: '#FFC61E', textShadowColor: 'rgba(255,198,30,0.6)' }]}>+1</Text>
          <Text style={styles.bigNumLabel}>FIRST TO ANSWER</Text>
        </View>
      );
    case 'board':
      return (
        <View style={styles.board}>
          {SCORES.map((s, i) => {
            const lead = s.pt === 110;
            return (
              <View key={i} style={[styles.scoreRow, lead && styles.scoreRowLead]}>
                <View style={[styles.swatch, { backgroundColor: s.color }]} />
                <View style={styles.scoreBar} />
                <Text style={styles.scorePt}>{s.pt}</Text>
              </View>
            );
          })}
        </View>
      );
    case 'categories':
      return (
        <View style={styles.squares}>
          {SQUARES.map((s) => (
            <View key={s.label} style={[styles.square, { backgroundColor: s.color }]}>
              <Text style={styles.squareText} numberOfLines={1}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      );
    case 'cards':
    case 'cardsMax':
      return (
        <View style={styles.cardRow}>
          {(['Joker', 'Changer', 'Eliminator', 'Skipper'] as CardName[]).map((n) => (
            <CardArt
              key={n}
              name={n}
              badge={art === 'cardsMax' ? t(n === 'Joker' ? 'howTo.max1' : 'howTo.max3') : undefined}
            />
          ))}
        </View>
      );
    case 'joker':
      return <CardArt name="Joker" big />;
    case 'changer':
      return <CardArt name="Changer" big />;
    case 'eliminator':
      return <CardArt name="Eliminator" big />;
    case 'skipper':
      return <CardArt name="Skipper" big />;
    case 'stars':
      return (
        <View style={styles.starsRow}>
          {Array.from({ length: 5 }, (_, i) => (
            <Ionicons key={i} name="star" size={30} color="#FFC61E" style={styles.star} />
          ))}
        </View>
      );
    case 'arrows':
      return (
        <View style={styles.arrows}>
          <View style={[styles.arrow, { borderColor: neon.blue.stroke, boxShadow: outerGlow(neon.blue) }]}>
            <Ionicons name="refresh" size={30} color={neon.blue.stroke} style={{ transform: [{ scaleX: -1 }] }} />
            <Text style={[styles.arrowText, { color: neon.blue.stroke }]}>{t('direction.anticlockwise')}</Text>
          </View>
          <View style={[styles.arrow, { borderColor: neon.green.stroke, boxShadow: outerGlow(neon.green) }]}>
            <Ionicons name="refresh" size={30} color={neon.green.stroke} />
            <Text style={[styles.arrowText, { color: neon.green.stroke }]}>{t('direction.clockwise')}</Text>
          </View>
        </View>
      );
    case 'yourChoice':
      return (
        <View style={styles.stack}>
          <View style={[styles.wideSquare, { backgroundColor: '#25D366' }]}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.wideSquareText}>YOUR CHOICE</Text>
          </View>
          <View style={[styles.wideSquare, { backgroundColor: '#E6394F' }]}>
            <Ionicons name="restaurant" size={18} color="#fff" />
            <Text style={styles.wideSquareText}>POT LUCK</Text>
          </View>
        </View>
      );
    case 'battle':
      return (
        <View style={styles.center}>
          <View style={styles.battleTag}>
            <Text style={styles.battleTagText}>{t('battle.title')}</Text>
          </View>
          <View style={styles.diceRow}>
            <Die value={6} size={56} />
            <Text style={styles.vs}>VS</Text>
            <Die value={3} size={56} />
          </View>
        </View>
      );
    case 'timer':
      return (
        <View style={styles.timer}>
          <Text style={styles.timerNum}>10</Text>
          <Text style={styles.timerLabel}>{t('challenge.timeLeft')}</Text>
        </View>
      );
    case 'giveItUp':
      return (
        <View style={[styles.wideSquare, { backgroundColor: '#E6394F' }]}>
          <Ionicons name="hand-left" size={22} color="#fff" />
          <Text style={styles.wideSquareText}>GIVE IT UP</Text>
        </View>
      );
    case 'curveball':
      return (
        <Image
          source={{ uri: assetUrl('/images/curveball.png') }}
          style={styles.curveball}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      );
    case 'buttons':
      return (
        <View style={styles.iconRow}>
          <View style={[styles.iconBtn, { borderColor: '#FF3B52', boxShadow: '0 0 12px rgba(255,59,82,0.4)' }]}>
            <Ionicons name="pause" size={28} color="#FF3B52" />
          </View>
          <View style={[styles.iconBtn, { borderColor: neon.blue.stroke, boxShadow: outerGlow(neon.blue) }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color={neon.blue.stroke} />
          </View>
          <View style={[styles.iconBtn, { borderColor: neon.blue.stroke, boxShadow: outerGlow(neon.blue) }]}>
            <Ionicons name="grid" size={26} color={neon.blue.stroke} />
          </View>
        </View>
      );
    case 'trophy':
      return <Ionicons name="trophy" size={96} color="#FFC61E" style={styles.trophy} />;
    case 'resume':
      return (
        <View style={styles.resume}>
          <Text style={styles.resumeTitle}>{t('home.resume')}</Text>
          <Text style={styles.resumeSub}>{t('home.resumeInGame')}</Text>
        </View>
      );
  }
}

/** `**đậm**` → chữ đậm; `• ` đầu dòng → gạch đầu dòng thụt vào. */
function Rich({ text: raw, style, width }: { text: string; style: object; width: number }) {
  const bullet = raw.startsWith('• ');
  const body = bullet ? raw.slice(2) : raw;
  const parts = body.split('**');
  return (
    <Text style={[style, { width: bullet ? width - 18 : width, marginLeft: bullet ? 18 : 0 }]}>
      {bullet ? '•  ' : ''}
      {parts.map((part, i) => (
        <Text key={i} style={i % 2 === 1 ? styles.bold : undefined}>
          {part}
        </Text>
      ))}
    </Text>
  );
}

type Section = 'general' | 'trivia';

export default function HowToPlayScreen() {
  const router = useRouter();
  const t = useT();
  const params = useLocalSearchParams<{ section?: string }>();
  const section: Section | null = params.section === 'general' || params.section === 'trivia' ? params.section : null;

  const [games, setGames] = useState<StoreGame[]>([]);
  useEffect(() => {
    let alive = true;
    void fetchStoreGames().then((r) => {
      if (alive && r.isSuccess) setGames(r.games);
    });
    return () => {
      alive = false;
    };
  }, []);

  // ✕ = về HOME kể cả đang ở mục con (mục con push lên trên hub - `replace` chỉ thay trang trên cùng).
  const close = () => (router.canDismiss() ? router.dismissAll() : router.replace('/'));

  if (!section) {
    return (
      <Frame title={t('howTo.hubTitle')} onBack={() => router.back()} onClose={close}>
        <View style={styles.hub}>
          <Pressable
            onPress={() => router.push({ pathname: '/how-to-play', params: { section: 'general' } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          >
            <View style={styles.tileArt}>
              <Ionicons name="book-outline" size={64} color="#5FE6FF" />
              <View style={styles.tileCheck}>
                <Ionicons name="checkmark" size={18} color="#04061A" />
              </View>
            </View>
            <Text style={styles.tileLabel}>{t('howTo.hubGeneral')}</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push({ pathname: '/how-to-play', params: { section: 'trivia' } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          >
            <View style={[styles.tileArt, styles.tileLogos]}>
              {games.slice(0, 3).map((g) =>
                g.logoUrl ? (
                  <Image key={g.sponsorId} source={{ uri: assetUrl(g.logoUrl) }} style={styles.tileLogo} resizeMode="contain" accessibilityIgnoresInvertColors />
                ) : null,
              )}
            </View>
            <Text style={styles.tileLabel}>{t('howTo.hubTrivia')}</Text>
          </Pressable>

          {/* Cyclic Career: chưa có nội dung - ô logo giữ chỗ như ảnh mẫu. */}
          <View style={[styles.tile, styles.tileSoon]}>
            <View style={[styles.tileArt, styles.careerBox]}>
              <Text style={styles.careerText}>logo</Text>
            </View>
            <Text style={styles.tileLabel}>{t('howTo.hubCareer')}</Text>
          </View>
        </View>
      </Frame>
    );
  }

  const pages = section === 'general' ? GENERAL_PAGES : [...TRIVIA_HEAD, ...PAGES];
  return (
    <Pager
      key={section}
      title={t(section === 'general' ? 'howTo.generalTitle' : 'howTo.triviaTitle')}
      pages={pages}
      onExit={() => router.back()}
      onClose={close}
      t={t}
    />
  );
}

/** Khung chung: ‹ Back trái, tiêu đề giữa, ✕ vàng phải (ảnh mẫu 19/9). */
function Frame({
  title,
  onBack,
  onClose,
  children,
}: {
  title: string;
  onBack: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <View style={styles.root}>
      <StageBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.body}>
          <Pressable style={styles.back} onPress={onBack} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={text.primary} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
          <Pressable style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.cancel')} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

function Pager({
  title,
  pages,
  onExit,
  onClose,
  t,
}: {
  title: string;
  pages: Page[];
  onExit: () => void;
  onClose: () => void;
  t: ReturnType<typeof useT>;
}) {
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(pages.length - 1, i));
    scroll.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const last = index === pages.length - 1;
  const nextColor = last ? neon.orange : neon.green;

  /*
   * Bề rộng hai cột tính TAY từ bề rộng pager: trong ScrollView ngang, con nhận
   * bề rộng theo nội dung nên `flex`/phần trăm không ép được Text xuống dòng -
   * đo 10:11–10:12 12/9, chữ chạy tuột ra ngoài mép phải cả hai lần thử.
   */
  const inner = width - PAGE_PAD * 2 - PAGE_GAP;
  const artW = Math.round(inner * 0.34);
  const copyW = inner - artW;
  /* Trang kiểu mới: chữ 56% trái, ảnh 44% phải. */
  const photoW = Math.round(inner * 0.44);
  const richW = inner - photoW;

  return (
    <Frame title={title} onBack={() => (index === 0 ? onExit() : goTo(index - 1))} onClose={onClose}>
      {pages[index].heading ? null : <Text style={styles.eyebrow}>{t(pages[index].eyebrow)}</Text>}
      <Text style={styles.pageNum}>
        {index + 1} / {pages.length}
      </Text>

      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={styles.pager}
      >
        {width > 0 &&
          pages.map((p, i) =>
            p.art === 'photo' || p.art === 'placeholder' ? (
              <View key={i} style={[styles.page, { width }]}>
                <ScrollView style={{ width: richW }} contentContainerStyle={styles.richCol} showsVerticalScrollIndicator={false}>
                  {p.heading ? <Text style={[styles.heading, { width: richW }]}>{t(p.heading)}</Text> : null}
                  {p.lines.map((k) => (
                    <Rich key={k} text={t(k)} style={styles.richLine} width={richW} />
                  ))}
                </ScrollView>
                <View style={[styles.photoCol, { width: photoW }]}>
                  {/* Kích thước ẢNH đặt bằng số: trong ScrollView ngang, '100%' không ép được Image co lại (đo 19/9, ảnh tràn cả trang). */}
                  {p.art === 'photo' && p.photo ? (
                    <Image source={p.photo} style={[styles.photo, { width: photoW, height: Math.round(photoW * 0.485) }]} resizeMode="contain" accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={[styles.placeholder, { width: photoW, height: Math.round(photoW * 0.58) }]}>
                      <Text style={styles.placeholderText}>{p.placeholder ? t(p.placeholder) : ''}</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View key={i} style={[styles.page, { width }]}>
                <View style={[styles.art, { width: artW }]}>
                  <PageArt art={p.art} t={t} />
                </View>
                <View style={[styles.copy, { width: copyW }]}>
                  {p.lines.map((k, j) => (
                    <Text key={k} style={[styles.line, { width: copyW }, j === p.strong && styles.lineStrong]}>
                      {t(k)}
                    </Text>
                  ))}
                </View>
              </View>
            ),
          )}
      </ScrollView>

      <View style={styles.nav}>
        <View style={styles.dots}>
          {pages.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>

        <Pressable
          onPress={() => (last ? onExit() : goTo(index + 1))}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.pill,
            { borderColor: nextColor.stroke, boxShadow: `${outerGlow(nextColor)}, ${innerGlow(nextColor)}` },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.pillText}>{t(last ? 'howTo.done' : 'howTo.next')}</Text>
        </Pressable>
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: bg.deep },
  safe: { flex: 1 },
  body: { flex: 1 },

  back: {
    position: 'absolute',
    top: 8,
    left: 12,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 12,
    gap: 2,
  },
  backText: { color: text.primary, fontSize: 16 },
  /* ✕ vàng góc phải (ảnh mẫu 19/9) - về Home. */
  close: { position: 'absolute', top: 8, right: 14, zIndex: 2, paddingVertical: 6, paddingHorizontal: 10 },
  closeText: { color: '#FFD84D', fontSize: 22, fontWeight: '800' },

  /* Trang chọn mục. */
  hub: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36, paddingHorizontal: 20 },
  tile: { width: 200, alignItems: 'center', gap: 12 },
  tileSoon: { opacity: 0.85 },
  tileArt: { width: 150, height: 110, alignItems: 'center', justifyContent: 'center' },
  tileCheck: { position: 'absolute', top: 2, right: 34, width: 26, height: 26, borderRadius: 13, backgroundColor: '#5FE6FF', alignItems: 'center', justifyContent: 'center' },
  tileLogos: { flexDirection: 'row', gap: 6 },
  tileLogo: { width: 46, height: 46 },
  careerBox: { width: 130, height: 68, borderRadius: 6, backgroundColor: '#3B6CE6' },
  careerText: { color: '#FFFFFF', fontSize: 22 },
  tileLabel: { color: text.primary, fontSize: 20, textAlign: 'center' },

  /* Trang kiểu mới. */
  richCol: { paddingVertical: 4, gap: 9, justifyContent: 'center', flexGrow: 1 },
  richLine: { color: text.primary, fontSize: 14.5, lineHeight: 20, flexShrink: 1 },
  heading: { color: text.primary, fontSize: 20, fontWeight: '800', marginBottom: 2 },
  bold: { fontWeight: '800', color: '#FFFFFF' },
  photoCol: { alignItems: 'center', justifyContent: 'center' },
  photo: { borderRadius: 10, borderWidth: 1, borderColor: 'rgba(148,163,255,0.35)' },
  placeholder: { alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(148,163,255,0.25)', backgroundColor: 'rgba(10,12,40,0.5)' },
  placeholderText: { color: '#FFD84D', fontSize: 22, textAlign: 'center', paddingHorizontal: 20 },

  title: {
    marginTop: 10,
    color: text.primary,
    fontSize: 24,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: 1.5,
    textAlign: 'center',
    textShadowColor: 'rgba(120,190,255,0.7)',
    textShadowRadius: 10,
  },
  eyebrow: {
    marginTop: 2,
    color: '#5FE6FF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  pageNum: {
    position: 'absolute',
    right: 20,
    top: 44,
    color: 'rgba(255,255,255,0.32)',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },

  pager: { flex: 1, marginTop: 6 },
  page: { flexDirection: 'row', paddingHorizontal: PAGE_PAD, paddingVertical: 8, gap: PAGE_GAP },
  /** Khung hình bên trái - cùng viền cyan với khung chọn hướng của màn ván. */
  /** Bề rộng đặt inline theo `artW` / `copyW` - xem ghi chú ở component. */
  art: {
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: 'rgba(95,230,255,0.35)',
    backgroundColor: 'rgba(4,4,14,0.72)',
    boxShadow: '0 0 20px rgba(31,111,214,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 10,
  },
  copy: { justifyContent: 'center', gap: 9 },
  line: { color: text.primary, fontSize: 15, lineHeight: 20, flexShrink: 1 },
  lineStrong: { color: '#FFE7A8', fontWeight: '700', fontSize: 16 },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 4,
    gap: 12,
  },
  pill: {
    width: 128,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0810',
  },
  pillDisabled: { opacity: 0.35 },
  pressed: { transform: [{ scale: 0.97 }] },
  pillText: { color: text.primary, fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotOn: { width: 18, backgroundColor: neon.orange.mid, boxShadow: '0 0 6px rgba(255,210,74,0.9)' },

  /* ---- hình minh hoạ ---- */
  center: { alignItems: 'center', justifyContent: 'center' },
  bigNum: { fontSize: 72, fontWeight: '800', lineHeight: 78, textShadowRadius: 18 },
  bigNumLabel: { color: text.muted, fontSize: 11, fontWeight: '700', letterSpacing: 2.5, marginTop: 2 },

  die: {
    backgroundColor: '#9C7CFF',
    flexDirection: 'row',
    flexWrap: 'wrap',
    boxShadow: '0 8px 18px rgba(0,0,0,0.5), inset 0 0 10px rgba(255,255,255,0.3)',
  },
  pipCell: { width: '33.33%', height: '33.33%', alignItems: 'center', justifyContent: 'center' },
  pip: { borderRadius: 999, backgroundColor: '#2A1660' },
  diceRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  vs: { color: text.muted, fontSize: 22, fontWeight: '800' },
  battleTag: {
    borderWidth: 1.4,
    borderColor: '#FF3B52',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  battleTagText: { color: '#FF3B52', fontSize: 12, fontWeight: '800', letterSpacing: 2 },

  board: { width: '100%', gap: 5 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(14,19,56,0.8)',
  },
  scoreRowLead: { borderColor: neon.green.stroke, boxShadow: outerGlow(neon.green) },
  swatch: { width: 16, height: 16, borderRadius: 4 },
  scoreBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)' },
  scorePt: { color: neon.green.stroke, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },

  squares: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  square: { width: '46%', paddingVertical: 12, paddingHorizontal: 4, borderRadius: 7, alignItems: 'center' },
  squareText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  stack: { width: '100%', gap: 8 },
  wideSquare: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  wideSquareText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 1 },

  /** 2×2: bốn thẻ trên một hàng không vừa cột trái, mà 3+1 thì lệch. */
  cardRow: { width: 58 * 2 + 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  card: {
    width: 58,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: '#0A0810',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  cardBig: { width: 108, height: 150, borderRadius: 12 },
  cardImage: { width: '100%', height: '100%' },
  cardBadge: {
    position: 'absolute',
    top: -8,
    right: -10,
    borderWidth: 1.2,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: '#000',
  },
  cardBadgeText: { fontSize: 9, fontWeight: '800' },

  starsRow: { flexDirection: 'row', gap: 4 },
  star: { textShadowColor: 'rgba(255,198,30,0.8)', textShadowRadius: 10 },

  arrows: { flexDirection: 'row', gap: 10 },
  arrow: {
    width: 92,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.4,
    alignItems: 'center',
    gap: 6,
  },
  arrowText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  timer: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 4,
    borderColor: '#FF3B52',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 18px rgba(255,59,82,0.55), inset 0 0 18px rgba(255,59,82,0.25)',
  },
  timerNum: { color: text.primary, fontSize: 46, fontWeight: '800', lineHeight: 50 },
  timerLabel: { color: text.muted, fontSize: 9, letterSpacing: 2, fontWeight: '700' },

  curveball: { width: '100%', height: '100%' },

  iconRow: { flexDirection: 'row', gap: 12 },
  iconBtn: { width: 56, height: 56, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  trophy: { textShadowColor: 'rgba(255,198,30,0.7)', textShadowRadius: 16 },

  resume: {
    borderWidth: 2,
    borderColor: neon.orange.stroke,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    boxShadow: `${outerGlow(neon.orange)}, ${innerGlow(neon.orange)}`,
  },
  resumeTitle: { color: text.primary, fontSize: 17, fontWeight: '800', letterSpacing: 1.5 },
  resumeSub: { color: text.muted, fontSize: 11, marginTop: 3 },
});
