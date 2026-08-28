/**
 * Chuỗi giao diện của app, đóng gói ngay trong bundle.
 *
 * Vì sao không lấy từ hệ localize trong DB của server: chuỗi của app native
 * gần như hoàn toàn MỚI (màn license, màn tạo phòng...), không trùng với web;
 * còn hệ localize kia hiện chỉ có 13 key. Đóng gói sẵn thì app hiện được ngay
 * lúc mở, chạy được cả khi mất mạng, và không phải chờ một lượt gọi server
 * trước khi vẽ màn hình đầu tiên.
 *
 * Server CHỈ quyết định ngôn ngữ nào được chọn (theo sponsor của license), chứ
 * không cấp nội dung chuỗi.
 *
 * Thêm ngôn ngữ mới: thêm một object nữa vào `translations` và khai báo vào
 * `SUPPORTED`. TypeScript sẽ bắt lỗi ngay nếu thiếu bất kỳ key nào, vì mọi bản
 * dịch đều phải khớp đúng tập key của `en`.
 */

export const en = {
  'common.back': 'Back',
  'common.cancel': 'Cancel',

  'home.newGame': 'NEW GAME',
  'home.register': 'REGISTER GAME',
  'home.resume': 'RESUME GAME',
  /** Dòng phụ dưới nút tiếp tục ván: đã có mấy người vào trên tổng số, và thể thức. */
  'home.resumeMinutes': '{joined}/{players} joined · {minutes} min',
  'home.resumeLeaderboard': '{joined}/{players} joined · Leaderboard',
  'home.startAnother': 'Start a different game',
  'home.startAnotherTitle': 'Leave the current game?',
  'home.startAnotherBody':
    'The game already set up will be abandoned. Anyone waiting in it will be dropped.',
  // Ngắn gọn: tiêu đề hộp thoại đã nói rõ đang bỏ ván nào, nhãn nút không cần
  // nhắc lại. Nhãn dài sẽ xuống hai dòng trong nút bo tròn.
  'home.startAnotherConfirm': 'Start new',

  /** Nhãn đổi theo số license: một cái thì chưa có gì để chuyển sang. */
  'home.switchGame': 'Switch Game',
  'home.addGame': 'Add another game',
  'switch.title': 'YOUR GAMES',
  'switch.subtitle': 'Each licence is a different game, with its own board and questions.',
  'switch.add': 'ADD A LICENCE',
  'switch.inUse': 'In use',
  'switch.unnamed': 'Licence {code}',
  'switch.pending': 'Not activated yet',
  'switch.remove': 'Remove licence',
  'switch.removeTitle': 'Remove {name}?',
  'switch.removeBody':
    'This licence is removed from this device only — your purchase is not affected. Any game waiting on it will be dropped, and you will need the code again to add it back.',
  'switch.removeConfirm': 'Remove',

  'home.join': 'JOIN A GAME',
  'home.purchase': 'PURCHASE',
  'home.howToPlay': 'HOW TO PLAY',

  'register.title': 'REGISTER GAME',
  'register.subtitle': 'Enter the licence code that came with your game to activate this device.',
  'register.codeLabel': 'LICENCE CODE',
  'register.codePlaceholder': 'e.g. CYCLIC-XXXX-XXXX',
  'register.submit': 'ACTIVATE',
  'register.codeRequired': 'Please enter your licence code.',
  'register.maxDevicesHint':
    'This licence has reached its device limit. Remove an old device, then try again.',

  'activate.infoTitle': 'ACTIVATE LICENCE',
  'activate.infoSubtitle':
    'This licence is not registered to anyone yet. Enter your name and email to get a confirmation code.',
  'activate.nameLabel': 'NAME',
  'activate.namePlaceholder': 'Your name',
  'activate.emailLabel': 'EMAIL',
  'activate.emailPlaceholder': 'you@example.com',
  'activate.sendCode': 'SEND CONFIRMATION CODE',
  'activate.infoRequired': 'Both name and email are required.',

  'activate.otpTitle': 'CONFIRMATION CODE',
  'activate.otpSubtitle': 'We sent a 6-character code to {email}.',
  'activate.otpLabel': 'CONFIRMATION CODE',
  'activate.otpPlaceholder': '6 characters',
  'activate.otpRequired': 'Please enter the code from your email.',
  'activate.confirm': 'CONFIRM',
  'activate.otpNote': "Can't find the email? Check your spam folder, or go back to send it again.",

  'activate.noSessionTitle': 'ACTIVATE',
  'activate.noSession': 'No activation in progress. Enter your licence code first.',
  'activate.goToRegister': 'ENTER LICENCE CODE',

  'newGame.title': 'NEW GAME',
  'newGame.subtitle': 'Set up the table, then let players join.',
  'newGame.players': 'PLAYERS',
  'newGame.duration': 'GAME LENGTH',
  'newGame.dice': 'DICE',
  'newGame.create': 'CREATE GAME',
  'newGame.loading': 'Loading game options…',
  'newGame.retry': 'TRY AGAIN',
  'newGame.noLicence': 'This device is not activated. Register a licence first.',

  'lobby.title': 'WAITING FOR PLAYERS',
  'lobby.subtitle': 'Share the code, let players scan the QR,\nor invite them to join.',
  'lobby.roomCode': 'ROOM CODE',
  'lobby.qrLabel': 'COMMON QR CODE',
  'lobby.inviteCopy': 'Invite friends to join\nyour trivia game',
  'lobby.invite': 'INVITE PLAYERS',
  'lobby.inviteMessage':
    'Join my Cyclic game!\n\nRoom code: {code}\n\nGot the app? Tap JOIN A GAME and type the code.\nNo app? Play in your browser: {url}',
  'lobby.inviteTitle': 'Join my Cyclic game',
  'lobby.seats': 'PLAYERS',
  'lobby.seatEmpty': 'Waiting…',
  'lobby.statusReady': 'Ready',
  'lobby.statusWaiting': 'Waiting',
  'lobby.host': 'HOST',
  'lobby.joinedCount': '{joined} of {total} joined',
  'lobby.start': 'START GAME',
  'lobby.startBlocked': 'Waiting for everyone to take a seat.',
  'lobby.loading': 'Preparing the room…',
  'lobby.retry': 'TRY AGAIN',
  'lobby.noGame': 'No game to show. Create one first.',
  'lobby.whoGoesFirst': 'WHO GOES FIRST?',
  'lobby.whoGoesFirstBody':
    'Get your phones ready! Answer the trivia question as fast as you can — the quickest correct answer starts the game.',
  'lobby.startingIn': '{seconds}s',

  'join.title': 'JOIN A GAME',
  'join.subtitle': 'Type the room code the host read out\nor sent you.',
  'join.codeLabel': 'ROOM CODE',
  'join.codePlaceholder': 'ABC123',
  'join.codeInvalid': 'A room code is {length} letters and numbers.',
  'join.submit': 'JOIN',
  'join.notFound': 'No room with that code. Check it and try again.',
  'join.notReady': 'That room is open, but the host has not set the game up yet. Ask them to create it, then try again.',
  'join.gameOver': 'That game has already finished.',
  'join.backToRoom': 'BACK TO YOUR ROOM',

  'seat.title': 'TAKE YOUR SEAT',
  'seat.subtitle': 'Pick a name and a character.\nThis is how everyone will see you.',
  'seat.nameLabel': 'YOUR NAME',
  'seat.namePlaceholder': 'Alex',
  'seat.nameRequired': 'Please enter a name.',
  'seat.nameTooLong': 'Keep it to {max} characters or fewer.',
  'seat.male': 'MALE',
  'seat.female': 'FEMALE',
  'seat.pickCharacter': 'YOUR CHARACTER',
  'seat.taken': 'TAKEN',
  'seat.submit': "I'M READY",
  'seat.noSeat': 'No seat to set up. Join a room first.',
  'seat.backToJoin': 'JOIN A GAME',

  'waiting.title': 'WAITING TO START',
  'waiting.subtitle': 'You are in. The host starts the game\nonce everyone has a seat.',
  'waiting.liveTitle': 'GAME STARTING',
  'waiting.liveSubtitle': 'Get your phone ready — the first question\ndecides who goes first.',
  'waiting.you': 'YOU ARE',
  'waiting.room': 'Room {code}',
  'waiting.opening': 'Opening the board…',
  'waiting.noSeat': 'You do not have a seat yet.',
  'waiting.backToJoin': 'JOIN A GAME',

  'game.title': 'IN GAME',
  'game.playerCount': '{count} players',
  'game.pause': 'Pause Game',
  'game.yourCards': 'YOUR CARDS',
  'game.card.Joker': 'JOKER',
  'game.card.Skipper': 'SKIPPER',
  'game.card.Eliminator': 'ELIMINATOR',
  'game.card.Changer': 'CHANGER',
  'game.rollDice': 'ROLL DICE',
  'game.noSeat': 'You do not have a seat in this game.',
  /** Loại bàn cờ chưa có nhánh vẽ - thà nói ra còn hơn để bàn cờ trắng trơn. */
  'game.boardUnsupported': 'This board type is not supported yet.',

  /** Nhãn góc trên màn câu hỏi của vòng đua "ai đi trước". */
  'question.race': 'WHO GOES FIRST?',
  'question.submit': 'SUBMIT',

  'cards.title': 'YOUR CARDS',
  'cards.prompt': 'Use a card before the question, or skip.',
  'cards.skip': 'SKIP',
  'cards.use': 'USE',
  'cards.body.Joker': 'Answer correctly and your points are doubled.',
  'cards.body.Skipper': 'Another question in the same category.',
  'cards.body.Eliminator': 'Removes one wrong answer.',
  'cards.body.Changer': 'Changes the category.',
  /** Người khác vừa dùng thẻ - hiện thoáng qua rồi tự tắt. */
  'cards.usedBy': '{name} used {card}',

  'dice.rolling': 'ROLLING…',
  'dice.rolled': 'YOU ROLLED',

  'direction.title': 'WHICH WAY WILL YOU GO?',
  'direction.clockwise': 'CLOCKWISE',
  'direction.anticlockwise': 'ANTI-CLOCKWISE',
  'direction.category': 'CATEGORY',
  'direction.quiz': 'QUIZ',
  'direction.battle': 'BATTLE',
  'direction.quizBody': 'Answer correctly to earn {points} {unit}.',
  /** Thể thức Leaderboard: thắng thì đứng lại, thua thì đi tiếp. */
  'direction.battleLeaderWin': 'Win: stay here and get a chance to earn 2 {unit}.',
  'direction.battleLeaderLose': 'Lose: move on to the next free square.',
  'direction.battleWin': 'Win to earn {points} {unit}.',
  'direction.battleRisk': 'Risking {percent}% of yours.',
  'direction.select': 'SELECT',
  'unit.point': 'point',
  'unit.points': 'points',
  'unit.run': 'run',
  'unit.runs': 'runs',
  'unit.goal': 'goal',
  'unit.goals': 'goals',

  'error.network': 'Cannot reach the server. Check your connection and the server address.',
  'error.timeout': 'The server did not respond. Check your connection and try again.',
  'error.http': 'Server returned error {status}. Check that the server is running.',
  'error.rejected': 'Request was rejected.',
} as const;

/** Mọi bản dịch phải phủ đúng tập key này. */
export type TranslationKey = keyof typeof en;

const vi: Record<TranslationKey, string> = {
  'common.back': 'Quay lại',
  'common.cancel': 'Huỷ',

  'home.newGame': 'TẠO VÁN MỚI',
  'home.register': 'ĐĂNG KÝ MÁY',
  'home.resume': 'TIẾP TỤC VÁN',
  'home.resumeMinutes': '{joined}/{players} người · {minutes} phút',
  'home.resumeLeaderboard': '{joined}/{players} người · Leaderboard',
  'home.startAnother': 'Tạo ván khác',
  'home.startAnotherTitle': 'Bỏ ván đang mở?',
  'home.startAnotherBody':
    'Ván đã dựng sẽ bị bỏ. Ai đang chờ trong đó sẽ bị văng ra.',
  'home.startAnotherConfirm': 'Tạo ván mới',

  'home.switchGame': 'Đổi game',
  'home.addGame': 'Thêm game khác',
  'switch.title': 'GAME CỦA BẠN',
  'switch.subtitle': 'Mỗi license là một game khác nhau, có bàn cờ và bộ câu hỏi riêng.',
  'switch.add': 'THÊM LICENSE',
  'switch.inUse': 'Đang dùng',
  'switch.unnamed': 'License {code}',
  'switch.pending': 'Chưa kích hoạt xong',
  'switch.remove': 'Gỡ license',
  'switch.removeTitle': 'Gỡ {name}?',
  'switch.removeBody':
    'License chỉ bị gỡ khỏi máy này, không ảnh hưởng tới gói bạn đã mua. Ván đang chờ trên license đó sẽ bị bỏ, và muốn thêm lại thì cần nhập mã lần nữa.',
  'switch.removeConfirm': 'Gỡ',

  'home.join': 'VÀO PHÒNG',
  'home.purchase': 'MUA BỘ TRÒ CHƠI',
  'home.howToPlay': 'CÁCH CHƠI',

  'register.title': 'ĐĂNG KÝ MÁY',
  'register.subtitle': 'Nhập mã license đi kèm bộ trò chơi để kích hoạt máy này.',
  'register.codeLabel': 'MÃ LICENSE',
  'register.codePlaceholder': 'VD: CYCLIC-XXXX-XXXX',
  'register.submit': 'KÍCH HOẠT',
  'register.codeRequired': 'Hãy nhập mã license.',
  'register.maxDevicesHint':
    'License này đã dùng hết số thiết bị cho phép. Gỡ bớt một thiết bị cũ rồi thử lại.',

  'activate.infoTitle': 'KÍCH HOẠT LICENSE',
  'activate.infoSubtitle':
    'License này chưa gắn với ai. Nhập tên và email để nhận mã xác nhận.',
  'activate.nameLabel': 'TÊN',
  'activate.namePlaceholder': 'Tên của bạn',
  'activate.emailLabel': 'EMAIL',
  'activate.emailPlaceholder': 'ban@example.com',
  'activate.sendCode': 'GỬI MÃ XÁC NHẬN',
  'activate.infoRequired': 'Cần nhập cả tên và email.',

  'activate.otpTitle': 'NHẬP MÃ XÁC NHẬN',
  'activate.otpSubtitle': 'Đã gửi mã 6 ký tự tới {email}.',
  'activate.otpLabel': 'MÃ XÁC NHẬN',
  'activate.otpPlaceholder': '6 ký tự',
  'activate.otpRequired': 'Hãy nhập mã xác nhận trong email.',
  'activate.confirm': 'XÁC NHẬN',
  'activate.otpNote': 'Không thấy email? Kiểm tra hộp thư rác, hoặc quay lại để gửi lại mã.',

  'activate.noSessionTitle': 'KÍCH HOẠT',
  'activate.noSession': 'Chưa có phiên kích hoạt nào. Hãy nhập mã license trước.',
  'activate.goToRegister': 'NHẬP MÃ LICENSE',

  'newGame.title': 'TẠO VÁN MỚI',
  'newGame.subtitle': 'Dựng bàn chơi, rồi để người chơi vào phòng.',
  'newGame.players': 'SỐ NGƯỜI CHƠI',
  'newGame.duration': 'THỜI LƯỢNG',
  'newGame.dice': 'XÚC XẮC',
  'newGame.create': 'TẠO VÁN',
  'newGame.loading': 'Đang tải lựa chọn…',
  'newGame.retry': 'THỬ LẠI',
  'newGame.noLicence': 'Máy này chưa kích hoạt. Hãy đăng ký license trước.',

  'lobby.title': 'ĐANG CHỜ NGƯỜI CHƠI',
  'lobby.subtitle': 'Đọc mã cho mọi người, để họ quét QR,\nhoặc gửi lời mời.',
  'lobby.roomCode': 'MÃ PHÒNG',
  'lobby.qrLabel': 'MÃ QR CHUNG',
  'lobby.inviteCopy': 'Mời bạn bè vào\nchơi cùng',
  'lobby.invite': 'MỜI NGƯỜI CHƠI',
  'lobby.inviteMessage':
    'Vào chơi Cyclic với mình!\n\nMã phòng: {code}\n\nCó app rồi? Bấm VÀO PHÒNG rồi nhập mã.\nChưa có app? Chơi trên trình duyệt: {url}',
  'lobby.inviteTitle': 'Vào chơi Cyclic với mình',
  'lobby.seats': 'NGƯỜI CHƠI',
  'lobby.seatEmpty': 'Đang chờ…',
  'lobby.statusReady': 'Sẵn sàng',
  'lobby.statusWaiting': 'Đang chờ',
  'lobby.host': 'CHỦ VÁN',
  'lobby.joinedCount': 'đã vào {joined}/{total}',
  'lobby.start': 'BẮT ĐẦU',
  'lobby.startBlocked': 'Chờ mọi người nhận chỗ đã.',
  'lobby.loading': 'Đang mở phòng…',
  'lobby.retry': 'THỬ LẠI',
  'lobby.noGame': 'Không có ván nào để hiện. Hãy tạo ván trước.',
  'lobby.whoGoesFirst': 'AI ĐI TRƯỚC?',
  'lobby.whoGoesFirstBody':
    'Cầm sẵn điện thoại! Trả lời câu hỏi nhanh nhất có thể — ai đúng sớm nhất sẽ đi trước.',
  'lobby.startingIn': '{seconds}s',

  'join.title': 'VÀO PHÒNG',
  'join.subtitle': 'Nhập mã phòng mà chủ phòng đọc\nhoặc gửi cho bạn.',
  'join.codeLabel': 'MÃ PHÒNG',
  'join.codePlaceholder': 'ABC123',
  'join.codeInvalid': 'Mã phòng gồm {length} chữ và số.',
  'join.submit': 'VÀO',
  'join.notFound': 'Không có phòng nào mang mã này. Kiểm tra lại rồi thử tiếp.',
  'join.notReady': 'Phòng đã mở nhưng chủ phòng chưa tạo ván. Nhờ họ tạo rồi thử lại.',
  'join.gameOver': 'Ván này đã kết thúc rồi.',
  'join.backToRoom': 'VỀ PHÒNG CỦA BẠN',

  'seat.title': 'NHẬN CHỖ',
  'seat.subtitle': 'Chọn tên và nhân vật.\nMọi người sẽ thấy bạn như vậy.',
  'seat.nameLabel': 'TÊN CỦA BẠN',
  'seat.namePlaceholder': 'Bảo',
  'seat.nameRequired': 'Hãy nhập tên.',
  'seat.nameTooLong': 'Tối đa {max} ký tự thôi.',
  'seat.male': 'NAM',
  'seat.female': 'NỮ',
  'seat.pickCharacter': 'NHÂN VẬT',
  'seat.taken': 'ĐÃ CÓ NGƯỜI',
  'seat.submit': 'SẴN SÀNG',
  'seat.noSeat': 'Chưa có ghế nào để nhận. Vào phòng trước đã.',
  'seat.backToJoin': 'VÀO PHÒNG',

  'waiting.title': 'ĐANG CHỜ BẮT ĐẦU',
  'waiting.subtitle': 'Bạn đã vào. Chủ phòng sẽ bắt đầu\nkhi mọi người đã nhận chỗ.',
  'waiting.liveTitle': 'VÁN SẮP BẮT ĐẦU',
  'waiting.liveSubtitle': 'Cầm sẵn điện thoại — câu hỏi đầu tiên\nquyết định ai đi trước.',
  'waiting.you': 'BẠN LÀ',
  'waiting.room': 'Phòng {code}',
  'waiting.opening': 'Đang mở bàn cờ…',
  'waiting.noSeat': 'Bạn chưa có ghế nào.',
  'waiting.backToJoin': 'VÀO PHÒNG',

  'game.title': 'TRONG VÁN',
  'game.playerCount': '{count} người chơi',
  'game.pause': 'Tạm dừng',
  'game.yourCards': 'BÀI CỦA BẠN',
  'game.card.Joker': 'JOKER',
  'game.card.Skipper': 'SKIPPER',
  'game.card.Eliminator': 'ELIMINATOR',
  'game.card.Changer': 'CHANGER',
  'game.rollDice': 'TUNG XÚC XẮC',
  'game.noSeat': 'Bạn không có ghế trong ván này.',
  'game.boardUnsupported': 'Loại bàn cờ này chưa hỗ trợ.',

  'question.race': 'AI ĐI TRƯỚC?',
  'question.submit': 'GỬI',

  'cards.title': 'THẺ BÀI',
  'cards.prompt': 'Dùng một thẻ trước khi trả lời, hoặc bỏ qua.',
  'cards.skip': 'BỎ QUA',
  'cards.use': 'DÙNG',
  'cards.body.Joker': 'Trả lời đúng thì điểm được nhân đôi.',
  'cards.body.Skipper': 'Đổi câu khác, cùng chủ đề.',
  'cards.body.Eliminator': 'Bỏ bớt một đáp án sai.',
  'cards.body.Changer': 'Đổi sang chủ đề khác.',
  'cards.usedBy': '{name} dùng {card}',

  'dice.rolling': 'ĐANG TUNG…',
  'dice.rolled': 'BẠN TUNG ĐƯỢC',

  'direction.title': 'BẠN ĐI HƯỚNG NÀO?',
  'direction.clockwise': 'THUẬN CHIỀU',
  'direction.anticlockwise': 'NGƯỢC CHIỀU',
  'direction.category': 'CHỦ ĐỀ',
  'direction.quiz': 'CÂU HỎI',
  'direction.battle': 'ĐẤU',
  'direction.quizBody': 'Trả lời đúng được {points} {unit}.',
  'direction.battleLeaderWin': 'Thắng: đứng lại đây và có cơ hội được 2 {unit}.',
  'direction.battleLeaderLose': 'Thua: đi tiếp tới ô trống kế tiếp.',
  'direction.battleWin': 'Thắng được {points} {unit}.',
  'direction.battleRisk': 'Đổi lại, thua mất {percent}% của bạn.',
  'direction.select': 'CHỌN',
  'unit.point': 'điểm',
  'unit.points': 'điểm',
  'unit.run': 'run',
  'unit.runs': 'run',
  'unit.goal': 'bàn',
  'unit.goals': 'bàn',

  'error.network': 'Không kết nối được tới server. Kiểm tra mạng và địa chỉ server.',
  'error.timeout': 'Server không phản hồi. Kiểm tra kết nối rồi thử lại.',
  'error.http': 'Server trả lỗi {status}. Kiểm tra lại server có đang chạy không.',
  'error.rejected': 'Yêu cầu bị từ chối.',
};

export const translations = { en, vi } as const;

/**
 * Chỉ dùng phần GỐC của mã ngôn ngữ, không có phần vùng miền.
 *
 * Lý do: hai bảng trong DB đang lệch nhau - `Languages` dùng "en-GB" (ngôn ngữ
 * của bộ câu hỏi) còn `localize.Domain.Cultures` dùng "en-US". Cắt về "en" thì
 * cả hai cùng ra một chỗ, và sau này thêm en-AU/en-IN cũng không phải sửa gì.
 */
export type Language = keyof typeof translations;

export const SUPPORTED: Language[] = ['en', 'vi'];
export const FALLBACK: Language = 'en';

/** "en-GB" -> "en". Trả về null nếu không nhận ra. */
export function toLanguage(code: string | null | undefined): Language | null {
  if (!code) return null;
  const base = code.toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED as string[]).includes(base) ? (base as Language) : null;
}
