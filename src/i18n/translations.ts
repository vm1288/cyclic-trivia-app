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
  /* Ván đang chơi dở - không có số người/thời lượng vì lúc này không hỏi tới. */
  'home.resumeInGame': 'Game in progress · tap to rejoin',
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
  /*
   * TẠM DỪNG - chép nguyên văn bản web (`PlayerHomeScreen.cshtml`,
   * `playerHandlers.js` handlePauseGame, `HomeController` PauseGame).
   */
  'game.pause': 'Pause game',
  'game.resume': 'Resume game',
  /** Gói 82 - server gửi, có tên người tới lượt: "Game pause once {name} finishes 3 turns or loses the dice." */
  'game.pausePending': 'Game pause once {name} finishes 3 turns or loses the dice.',
  'game.pausedHost':
    'You’ve paused the game. As the host, you can resume the game by tapping the green button above - once everyone’s ready.',
  'game.pausedGuest': 'Game paused by the host. Tap the resume button on the host’s phone to continue.',
  'game.pausedTitle': 'GAME PAUSED',
  /*
   * Hộp "rời ván" khi bấm BACK cứng - tiêu đề và hai nút chép nguyên văn
   * designs/LeaveGameModal.tsx; thân là chữ của app (bản thiết kế để lorem ipsum).
   */
  'game.leaveTitle': 'Leave the current Game?',
  'game.leaveBody':
    'The game keeps going without you. Your seat is kept - come back any time with RESUME GAME on the home screen.',
  'game.leaveCancel': 'CANCEL',
  'game.leaveConfirm': 'LEAVE',
  /*
   * CURVE BALL - tiêu đề chép bàn cờ web (`CaseActionShowCurveBall`); câu hiệu ứng
   * chép `Helper.GetCurveMessageText` (server), khoá theo tên `CurveBallType`.
   * Thiếu khoá thì app hiện nguyên `Message` server gửi.
   */
  'curve.title': 'Curve Ball',
  'curve.titleCric': 'Googly',
  'curve.titleFootie': 'VAR decisions',
  'curve.ReverseOrder': 'The sequence reverses',
  'curve.ReduceAnswerTime': 'The times for answering questions are reduced by 20% for the rest of the game.',
  'curve.JokerX3': 'In future, use of Joker gets x3 (so generally 6 points) for a correct',
  'curve.HasNoJGetBack': 'Anyone who has no J gets it back.',
  'curve.WhoHasJLostIt': 'Everyone who has a J loses it.',
  'curve.RemoveAllCCardFromPlayers': 'All C cards are removed from all players.',
  'curve.RemoveAllECardFromPlayers': 'All E cards are removed from all players.',
  'curve.RemoveAllSCardFromPlayers': 'All S cards are removed from all players.',
  'curve.EveryoneLoseAllCards': 'Everyone loses all cards.',
  'curve.EveryoneLoseAllStars': 'Everyone loses all stars.',
  /* Chat - chữ của app, bản web không có chat. */
  'chat.title': 'CHAT',
  'chat.placeholder': 'Type a message…',
  'chat.send': 'SEND',
  'chat.empty': 'No messages yet. Say hi to the table!',
  'common.close': 'Close',
  'game.yourCards': 'YOUR CARDS',
  'game.card.Joker': 'JOKER',
  'game.card.Skipper': 'SKIPPER',
  'game.card.Eliminator': 'ELIMINATOR',
  'game.card.Changer': 'CHANGER',
  /* Hộp xác nhận trước khi dùng thẻ trong câu hỏi - chép chữ bản web. */
  'card.confirmTitle': 'Use {card} card now?',
  'card.confirmUse': 'USE',
  'card.confirmSkip': 'SKIP',
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
  /** Đủ 5 sao thì được thưởng một lá bài. */
  'cards.earned': '5 stars! You earned {card}',
  'cards.earnedAny': '5 stars! You earned a card',

  /**
   * Ô 10-SEC CHALLENGE. `challenge.reader` chỉ hiện ở kiểu thử thách "B", khi
   * mỗi người được chia một phần lời để đọc.
   */
  /** Ô YOUR CHOICE. Chữ lấy NGUYÊN VĂN từ `QuestionCategoryPartialHtml.cshtml`. */
  'yourChoice.title': 'What question category would you like?',
  'yourChoice.noCard': 'No special card can be played',
  /** Ô cuối lưới, bản web tự chèn thêm. GUID rỗng = server bốc random + điểm ×2. */
  'yourChoice.potLuck': 'Pot Luck (double points)',

  'challenge.title': '10-SEC CHALLENGE',
  /** Người đọc thứ mấy - chỉ có ở kiểu thử thách "B". */
  'challenge.reader': 'You are the {ordinal} person to read.',
  'challenge.words': 'Your words:',
  'challenge.readAloud': 'Please read your word out loud!',
  'challenge.readAloudTurn': 'Please read your word out loud when it is your turn!',
  'challenge.startWhenReady': 'When ready to start, please tap the button below to start the challenge.',
  'challenge.startAfterAll': 'Once all players have finished reading their words, tap the button below to start the challenge!',
  'challenge.start': 'Start',
  /** Người ĐỌC không có nút nào - chỉ chờ trọng tài bấm Start. */
  'challenge.waitJudge': 'Waiting for {name} to start the challenge…',
  /** Nhịp đếm ngược: đề bài + đồng hồ. Chép từ `TenSecondsChallenge.cshtml`. */
  'challenge.hereIsYours': '{name}, here is your 10-second Challenge',
  'challenge.checkPhones': 'All other players, please check your phones to view your assigned word.',
  'challenge.judgeLineMulti': "{name}, you are the judge. When ready to start, you should tap the 'Start' button on your phone.",
  'challenge.judgeLineTwo': '{name}, when ready to start, you should tap the "Start" button on your phone.',
  'challenge.timeLeft': 'TIME LEFT',
  'challenge.verdict': 'Was the attempt at the 10-second Challenge successful?',
  'challenge.pass': 'Pass',
  'challenge.fail': 'Fail',

  'dice.rolling': 'ROLLING…',
  'dice.rolled': 'YOU ROLLED',

  /** Kết quả một câu trả lời, hiện giữa bàn cờ. */
  /*
   * ⚠️ CHỮ LẤY NGUYÊN VĂN TỪ VIEW CỦA BẢN WEB, đừng tự viết lại:
   *   Views/Public/Html/CorrectAnswer.cshtml       -> correct / earned
   *   Views/Public/Html/PlayerWrongAnswer.cshtml   -> wrong / wrongBody
   *   Views/Public/Html/PlayerTimeoutAnswer.cshtml -> timeout / wrongBody
   *   Views/Public/Html/OtherCorrectAnswer.cshtml  -> late
   * Đây là chữ team đã thống nhất - người chơi web và người chơi app phải đọc
   * cùng một câu.
   */
  /*
   * ẨN BÀN CỜ (ca UI-1). Chỉ là chuyện hiển thị của riêng một máy - không có
   * chữ tương ứng ở bản web, vì bản web có bàn cờ riêng trên TV.
   */
  'board.hide': 'Hide the board',
  'board.show': 'SHOW BOARD',
  'board.hiddenTitle': 'BOARD HIDDEN',
  'board.hiddenBody': 'Questions and answers get the whole space. Tap to bring the board back.',

  'result.correct': '{name} got it right!',
  /** `{unit}` là runs / goals / points tuỳ bàn. Dấu chấm cuối là của bản web. */
  'result.earned': '{point} {unit}.',
  /** Hiện thêm khi người chơi còn lượt tung nữa (`MaxTries < TurnMaxTries`). */
  'result.rollAgainSecond': 'Your second roll please',
  'result.rollAgainThird': 'Your third roll please',
  'result.wrong': '{name} got it wrong!',
  'result.wrongBody': 'The others are racing to answer correctly',
  'result.timeout': "{name}, you're out of time!",
  'result.late': 'got it right first!',
  'result.lateBy': '{name}',

  /** Vòng đua xong - câu này hiện giữa bàn cờ, giống bàn cờ của bản web. */
  'race.winner': '{name} is the fastest!',
  'race.winnerYou': 'You are the fastest!',
  'race.first': 'They take the first turn!',
  'race.firstYou': 'You take the first turn',

  /*
   * BATTLE. Chữ chép từ `PlayerBattleInstruction.cshtml` và
   * `PlayerBattleStartPartialHtml.cshtml` của bản web - xem GAME_RULES mục 7b.
   *
   * ⚠ `battle.win`/`battle.lose` chỉ dùng ở ván KHÔNG tính leaderboard. Ván có
   * tính thì không ai mất điểm, phải dùng cặp `leader*`.
   */
  'battle.title': 'BATTLE',
  'battle.challengedYou': '{name} has challenged you!',
  'battle.youChallenge': "You're challenging {name}",
  'battle.rules':
    "3 questions each, answered at the same time. Most right wins. Still tied? One tie-breaker question, then a dice roll.",
  'battle.win': 'Win this battle to earn {points} {unit}.',
  'battle.lose': 'If you lose, you hand over {points} {unit}.',
  'battle.leaderWin': 'Win to stay on this square and take the next turn.',
  'battle.leaderLose': 'Lose and you move back to the nearest free square.',
  'battle.start': 'START',
  'battle.starting': 'STARTING...',
  'battle.waiting': 'Waiting for {name} to start the battle...',
  /** Nhãn góc trên khung câu hỏi battle - "BATTLE 2/3". */
  'battle.question': 'BATTLE {index}/3',
  /** Câu sudden death: hết 3 câu mà vẫn hoà. */
  /* K57: câu thứ 4 là CÂU PHỤ, không còn sudden death. */
  'battle.tieBreaker': 'TIE-BREAKER',
  /* Chữ chép mockup "Battle - Tie-breaker" của Tony (bàn cờ web). */
  'battle.tieBreakerTime': "It's tie-breaker time!",
  'battle.resultTitle': 'We have a result.',
  'battle.noWinner': 'After one tie-breaker question, no winner was determined.',
  'battle.diceTitle':
    'Still tied! Both players must now roll a die, the player with the higher roll wins the battle.',
  'battle.diceYouFirst': 'You go first!',
  'battle.diceYourTurn': "It's your turn!",
  'battle.diceWaiting': 'Waiting...',
  'battle.diceRolling': 'Rolling...',
  'battle.diceWon': '{name} won!',
  'battle.diceWonYou': 'You won!',
  'battle.diceTie': 'Same roll - roll again! (round {round})',
  'battle.diceYou': 'you',
  /** Tổng kết - gói 84 là chỗ duy nhất biết ai đúng mấy câu. */
  'battle.score': 'You {mine} - {theirs} {name}',
  'battle.wonYou': 'You won the battle!',
  'battle.won': '{name} won the battle',
  'battle.wonBody': 'You stay on this square.',
  'battle.lostBody': 'You move back to the nearest free square.',
  /** Người NGOÀI cuộc chỉ thấy một dòng thoáng qua. */
  'battle.notice': 'Battle: {a} vs {b}',

  /*
   * Ghế bị mở ở máy khác (gói 88). Đừng hứa "thử lại" — máy này không giành lại
   * được ghế, và cố nối lại thì hai máy đá nhau vô tận.
   */
  'gameOver.title': 'GAME OVER',
  'gameOver.leave': 'BACK TO HOME',
  'gameOver.youSuffix': ' (you)',
  'gameOver.defaultMessage': 'That is the final score.',
  /*
   * Hai phần của màn xếp hạng, CHỈ hiện với thể thức Leaderboard Challenge -
   * xem `GameOverOverlay`. Chữ chép theo bản web (`MainBoard.cshtml`).
   */
  /* Nút trên khung Game Over, chỉ thể thức Leaderboard Challenge - chữ của bản web (`mainControl.js`). */
  'gameOver.leaderboard': 'LEADERBOARD',
  /*
   * Chủ phòng chọn gì sau khi hết ván - chữ chép từ `playerHandlers.js`
   * (handleGameOver, EndGame) và bàn cờ web (`mainControl.js`, `mainHandlers.js`).
   */
  'gameOver.choose': 'Please choose',
  'gameOver.endGame': 'END GAME',
  'gameOver.playAgain': 'PLAY AGAIN',
  'gameOver.thanks': 'Thanks for playing!',
  'gameOver.settingUp': 'Setting up a new match. Get ready!',
  'gameOver.waitingHost': 'Waiting for host. {name}, please select Play Again or End Game on your device.',
  /*
   * Cây "Play again" - chữ chép nguyên văn từ `playerHandlers.js` và hai Vue
   * component `SelectDurations` / `SelectPlayers` của bản web.
   */
  'again.hostQ': 'Do you still want to host the next game?',
  'again.hostHint': 'If YES, you will remain the Host and complete the setup for the new season.',
  'again.hostYes': 'YES, play and host',
  'again.hostNo': 'NO, assign new host',
  'again.assignTitle': 'Since you are leaving, please appoint a new Host to take over.',
  'again.assign': 'Assign host',
  'again.chooseOne': 'Please choose one',
  'again.durationQ': 'Same game duration / format?',
  'again.durationYes': 'Yes, keep it',
  'again.durationNo': 'No, I want to change',
  'again.pickDuration': 'Game length',
  'again.playersQ': 'Same players as the last game?',
  'again.playersYes': 'Yes, same players',
  'again.playersNo': 'No, change players',
  'again.pickCount': 'Please advise the number of people playing:',
  'again.pickWho': 'Please indicate which of these players will be playing again:',
  'again.none': 'Please tap at least one player',
  'again.tooMany': "Mmm… you've tapped more players playing again than the number you said would be playing. Can you please check.",
  'again.less': 'You advised {count} players but just {selected} of the previous ones are playing. Is that right?',
  'again.lessHint': "Great, we'll put up the room code again to allow the new players to join.",
  'again.lessYes': 'Yes, that is right',
  'again.optedOut': "YOU'VE OPTED OUT OF THE NEXT GAME.",
  'again.optedOutHint': 'Is that right? If yes, please select a new Host from the active players to manage the next session.',
  'again.continue': 'Continue',
  'again.back': 'Back',
  'again.cancel': 'Cancel',
  'gameOver.newHostTitle': 'YOU ARE THE NEW HOST!',
  'gameOver.newHostBody': 'You now have the power to decide the next game.',
  'gameOver.handedOver': '{name} is the new host. Waiting for them to set up the next game.',
  'gameOver.global': 'GLOBAL LEADERBOARD',
  'gameOver.currentMatch': 'CURRENT MATCH RESULT',
  'gameOver.boardFailed': "Couldn't load the leaderboard.",

  'conn.replacedTitle': 'This seat was opened on another device',
  'conn.replacedBody':
    'Only one device can play a seat at a time. Carry on there, or take a seat again from the home screen.',

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
  'home.resumeInGame': 'Ván đang chơi dở · chạm để vào lại',
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
  'game.resume': 'Tiếp tục',
  'game.pausePending': 'Ván sẽ tạm dừng khi {name} chơi xong 3 lượt hoặc mất xúc xắc.',
  'game.pausedHost':
    'Bạn đã tạm dừng ván. Là chủ phòng, bạn bấm nút xanh phía trên để chơi tiếp - khi mọi người đã sẵn sàng.',
  'game.pausedGuest': 'Chủ phòng đã tạm dừng ván. Chạm nút tiếp tục trên máy chủ phòng để chơi tiếp.',
  'game.pausedTitle': 'ĐANG TẠM DỪNG',
  'game.leaveTitle': 'Rời ván đang chơi?',
  'game.leaveBody':
    'Ván vẫn tiếp tục không có bạn. Ghế của bạn được giữ - quay lại lúc nào cũng được bằng TIẾP TỤC VÁN ở màn chính.',
  'game.leaveCancel': 'HUỶ',
  'game.leaveConfirm': 'RỜI VÁN',
  'curve.title': 'Curve Ball',
  'curve.titleCric': 'Googly',
  'curve.titleFootie': 'VAR decisions',
  'curve.ReverseOrder': 'Đảo chiều lượt chơi',
  'curve.ReduceAnswerTime': 'Thời gian trả lời câu hỏi giảm 20% cho tới hết ván.',
  'curve.JokerX3': 'Từ giờ dùng Joker được ×3 (thường là 6 điểm) khi trả lời đúng',
  'curve.HasNoJGetBack': 'Ai không còn thẻ J thì được lại.',
  'curve.WhoHasJLostIt': 'Ai đang có thẻ J thì mất.',
  'curve.RemoveAllCCardFromPlayers': 'Mọi thẻ C của mọi người bị thu.',
  'curve.RemoveAllECardFromPlayers': 'Mọi thẻ E của mọi người bị thu.',
  'curve.RemoveAllSCardFromPlayers': 'Mọi thẻ S của mọi người bị thu.',
  'curve.EveryoneLoseAllCards': 'Mọi người mất hết thẻ.',
  'curve.EveryoneLoseAllStars': 'Mọi người mất hết sao.',
  'chat.title': 'TRÒ CHUYỆN',
  'chat.placeholder': 'Nhập tin nhắn…',
  'chat.send': 'GỬI',
  'chat.empty': 'Chưa có tin nào. Chào cả bàn đi!',
  'common.close': 'Đóng',
  'game.yourCards': 'BÀI CỦA BẠN',
  'game.card.Joker': 'JOKER',
  'game.card.Skipper': 'SKIPPER',
  'game.card.Eliminator': 'ELIMINATOR',
  'game.card.Changer': 'CHANGER',
  'card.confirmTitle': 'Dùng thẻ {card} ngay bây giờ?',
  'card.confirmUse': 'DÙNG',
  'card.confirmSkip': 'BỎ QUA',
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
  'cards.earned': 'Đủ 5 sao! Bạn được thưởng {card}',
  'cards.earnedAny': 'Đủ 5 sao! Bạn được thưởng một lá bài',

  'yourChoice.title': 'Bạn muốn chủ đề nào?',
  'yourChoice.noCard': 'Không dùng được thẻ bài nào',
  'yourChoice.potLuck': 'Pot Luck (điểm nhân đôi)',

  'challenge.title': 'THỬ THÁCH 10 GIÂY',
  'challenge.reader': 'Bạn là người đọc thứ {ordinal}.',
  'challenge.words': 'Lời của bạn:',
  'challenge.readAloud': 'Hãy đọc to lời của bạn!',
  'challenge.readAloudTurn': 'Tới lượt mình thì đọc to lời của bạn nhé!',
  'challenge.startWhenReady': 'Sẵn sàng thì bấm nút bên dưới để bắt đầu thử thách.',
  'challenge.startAfterAll': 'Khi mọi người đã đọc xong, bấm nút bên dưới để bắt đầu thử thách!',
  'challenge.start': 'Bắt đầu',
  'challenge.waitJudge': 'Đang chờ {name} bấm bắt đầu…',
  'challenge.hereIsYours': '{name}, đây là thử thách 10 giây của bạn',
  'challenge.checkPhones': 'Những người còn lại xem điện thoại để biết phần lời của mình.',
  'challenge.judgeLineMulti': '{name}, bạn là trọng tài. Sẵn sàng thì bấm nút "Bắt đầu" trên điện thoại.',
  'challenge.judgeLineTwo': '{name}, sẵn sàng thì bấm nút "Bắt đầu" trên điện thoại.',
  'challenge.timeLeft': 'CÒN LẠI',
  'challenge.verdict': 'Thử thách 10 giây có thành công không?',
  'challenge.pass': 'Đạt',
  'challenge.fail': 'Hỏng',

  'dice.rolling': 'ĐANG TUNG…',
  'dice.rolled': 'BẠN TUNG ĐƯỢC',

  'board.hide': 'Ẩn bàn cờ',
  'board.show': 'HIỆN BÀN CỜ',
  'board.hiddenTitle': 'ĐÃ ẨN BÀN CỜ',
  'board.hiddenBody': 'Câu hỏi và kết quả được cả chỗ này. Chạm để hiện lại bàn cờ.',

  'result.correct': '{name} trả lời đúng!',
  'result.earned': '{point} {unit}.',
  'result.rollAgainSecond': 'Mời bạn tung lần hai',
  'result.rollAgainThird': 'Mời bạn tung lần ba',
  'result.wrong': '{name} trả lời sai!',
  'result.wrongBody': 'Những người khác đang tranh trả lời',
  'result.timeout': '{name}, bạn hết giờ rồi!',
  'result.late': 'chốt câu trước rồi!',
  'result.lateBy': '{name}',

  'race.winner': '{name} nhanh nhất!',
  'race.winnerYou': 'Bạn nhanh nhất!',
  'race.first': 'Người đó đi trước',
  'race.firstYou': 'Bạn đi trước',

  'battle.title': 'ĐẤU',
  'battle.challengedYou': '{name} thách đấu bạn!',
  'battle.youChallenge': 'Bạn đang thách đấu {name}',
  'battle.rules':
    'Mỗi người 3 câu, trả lời cùng lúc. Ai đúng nhiều hơn thì thắng. Vẫn hoà? Một câu phụ, rồi tung xúc xắc.',
  'battle.win': 'Thắng được {points} {unit}.',
  'battle.lose': 'Thua thì mất {points} {unit}.',
  'battle.leaderWin': 'Thắng thì ở lại ô này và được đi lượt kế.',
  'battle.leaderLose': 'Thua thì lùi về ô trống gần nhất.',
  'battle.start': 'BẮT ĐẦU',
  'battle.starting': 'ĐANG BẮT ĐẦU...',
  'battle.waiting': 'Đang đợi {name} bắt đầu trận đấu...',
  'battle.question': 'ĐẤU {index}/3',
  'battle.tieBreaker': 'CÂU PHỤ',
  'battle.tieBreakerTime': 'Tới câu phụ!',
  'battle.resultTitle': 'Đã có kết quả.',
  'battle.noWinner': 'Sau một câu phụ vẫn chưa phân thắng bại.',
  'battle.diceTitle': 'Vẫn hoà! Hai người tung xúc xắc, ai cao hơn thắng trận.',
  'battle.diceYouFirst': 'Bạn tung trước!',
  'battle.diceYourTurn': 'Tới lượt bạn!',
  'battle.diceWaiting': 'Đang chờ...',
  'battle.diceRolling': 'Đang tung...',
  'battle.diceWon': '{name} thắng!',
  'battle.diceWonYou': 'Bạn thắng!',
  'battle.diceTie': 'Bằng nhau - tung lại! (lần {round})',
  'battle.diceYou': 'bạn',
  'battle.score': 'Bạn {mine} - {theirs} {name}',
  'battle.wonYou': 'Bạn thắng trận đấu!',
  'battle.won': '{name} thắng trận đấu',
  'battle.wonBody': 'Bạn ở lại ô này.',
  'battle.lostBody': 'Bạn lùi về ô trống gần nhất.',
  'battle.notice': 'Đấu: {a} gặp {b}',

  'gameOver.title': 'HẾT VÁN',
  'gameOver.leave': 'VỀ MÀN CHÍNH',
  'gameOver.youSuffix': ' (bạn)',
  'gameOver.defaultMessage': 'Điểm cuối cùng là đây.',
  'gameOver.leaderboard': 'BẢNG XẾP HẠNG',
  'gameOver.choose': 'Mời chọn',
  'gameOver.endGame': 'KẾT THÚC',
  'gameOver.playAgain': 'CHƠI LẠI',
  'gameOver.thanks': 'Cảm ơn đã chơi!',
  'gameOver.settingUp': 'Đang dựng ván mới. Sẵn sàng nhé!',
  'gameOver.waitingHost': 'Đang chờ chủ phòng. {name}, hãy chọn Chơi lại hoặc Kết thúc trên máy của bạn.',
  'again.hostQ': 'Bạn còn muốn làm chủ phòng ván sau không?',
  'again.hostHint': 'Nếu CÓ, bạn vẫn là chủ phòng và sẽ dựng ván mới.',
  'again.hostYes': 'CÓ, chơi và làm chủ phòng',
  'again.hostNo': 'KHÔNG, giao cho người khác',
  'again.assignTitle': 'Bạn rời ghế chủ phòng — hãy chọn người thay.',
  'again.assign': 'Giao chủ phòng',
  'again.chooseOne': 'Hãy chọn một người',
  'again.durationQ': 'Giữ nguyên thể thức / thời lượng?',
  'again.durationYes': 'Giữ nguyên',
  'again.durationNo': 'Không, tôi muốn đổi',
  'again.pickDuration': 'Thời lượng ván',
  'again.playersQ': 'Cùng những người chơi như ván trước?',
  'again.playersYes': 'Đúng, cùng người',
  'again.playersNo': 'Không, đổi người chơi',
  'again.pickCount': 'Ván sau có mấy người chơi?',
  'again.pickWho': 'Ai trong số này chơi tiếp?',
  'again.none': 'Chọn ít nhất một người',
  'again.tooMany': 'Bạn chọn nhiều người hơn số người đã khai. Xem lại giúp nhé.',
  'again.less': 'Bạn khai {count} người nhưng chỉ {selected} người cũ chơi tiếp. Đúng chứ?',
  'again.lessHint': 'Được, phòng sẽ mở lại mã để người mới vào.',
  'again.lessYes': 'Đúng vậy',
  'again.optedOut': 'BẠN ĐÃ RÚT KHỎI VÁN SAU.',
  'again.optedOutHint': 'Đúng chứ? Nếu đúng, hãy chọn một người đang chơi làm chủ phòng ván sau.',
  'again.continue': 'Tiếp tục',
  'again.back': 'Quay lại',
  'again.cancel': 'Thôi',
  'gameOver.newHostTitle': 'BẠN LÀ CHỦ PHÒNG MỚI!',
  'gameOver.newHostBody': 'Bạn quyết định ván tiếp theo.',
  'gameOver.handedOver': '{name} là chủ phòng mới. Đang chờ họ dựng ván sau.',
  'gameOver.global': 'BẢNG XẾP HẠNG CHUNG',
  'gameOver.currentMatch': 'KẾT QUẢ VÁN NÀY',
  'gameOver.boardFailed': 'Không tải được bảng xếp hạng.',

  'conn.replacedTitle': 'Ghế này vừa được mở ở máy khác',
  'conn.replacedBody':
    'Mỗi ghế chỉ chơi được trên một máy. Chơi tiếp ở máy đó, hoặc quay về màn chính để nhận ghế lại.',

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
