import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaStream } from 'react-native-webrtc';

import { CallSession, type CallMember } from './CallSession';
import { TYPE_ID } from '../net/gameConnection';

/**
 * K145 — nối {@link CallSession} vào màn ván: giữ state cho React và bơm gói tin hai chiều.
 *
 * Vì sao tách khỏi `game-landscape.tsx`: màn đó đã hơn 4000 dòng, và toàn bộ việc ở đây **không
 * dính gì tới luật ván**. Hỏng hết thì ván vẫn chạy.
 *
 * ⚠️ `CallSession` sống trong `useRef`, KHÔNG phải state: nó giữ các `RTCPeerConnection`, dựng lại
 * mỗi lần render là rụng hết kết nối.
 */

export type CallApi = {
  /** Ai đang phát gì — từ gói 100. */
  members: CallMember[];
  /** Video đang nhận, theo `playerId` viết thường. */
  streams: Record<string, MediaStream>;
  /** Ghế nào nối hỏng — để hiện cảnh báo thay vì ô đen. */
  failed: Record<string, boolean>;
  /** Video của chính mình. */
  localStream: MediaStream | null;
  mic: boolean;
  cam: boolean;
  toggleMic: () => void;
  toggleCam: () => void;
  /** Có ai đang nói không — dùng để hạ nhạc nền. */
  speaking: boolean;
  /** Màn ván gọi khi nhận gói 100. */
  onState: (members: CallMember[]) => void;
  /** Màn ván gọi khi nhận gói 99. */
  onSignal: (from: string, data: string) => void;
};

/** Nhạc nền chỉ dâng lên lại sau khi im tiếng ngần này — đủ dài để đi qua khoảng lặng giữa hai câu. */
const SPEAK_HOLD_MS = 1500;

export function useCall({
  myId,
  seatToken,
  allPlayerIds,
  send,
  enabled,
}: {
  myId: string | undefined;
  seatToken: string | undefined;
  /** Mọi ghế trong ván, kể cả người chỉ xem. */
  allPlayerIds: string[];
  send: (typeID: number, payload?: unknown) => void;
  /** Chỉ chạy khi đang trong ván. */
  enabled: boolean;
}): CallApi {
  const [members, setMembers] = useState<CallMember[]>([]);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mic, setMic] = useState(false);
  const [cam, setCam] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const session = useRef<CallSession | null>(null);
  /** Lần cuối nghe thấy tiếng người — xem đoạn giữ cờ ở dưới. */
  const lastHeard = useRef(0);
  const sendRef = useRef(send);
  sendRef.current = send;
  const idsRef = useRef(allPlayerIds);
  idsRef.current = allPlayerIds;

  /* ── dựng / gỡ ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!enabled || !myId || !seatToken) return;

    const s = new CallSession({
      myId,
      seatToken,
      sendSignal: (to, data) => sendRef.current(TYPE_ID.CallSignal, { To: to, Data: data }),
      onStream: (playerId, stream) =>
        setStreams((prev) => {
          const key = playerId.toLowerCase();
          if (!stream) {
            if (!(key in prev)) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
          }
          return { ...prev, [key]: stream };
        }),
      onPeerState: (playerId, state) =>
        setFailed((prev) => {
          const key = playerId.toLowerCase();
          const bad = state === 'failed';
          if (!!prev[key] === bad) return prev;
          const next = { ...prev };
          if (bad) next[key] = true;
          else delete next[key];
          return next;
        }),
    });
    session.current = s;

    return () => {
      /*
       * ⚠️ PHẢI gỡ khi rời màn: bỏ quên là camera còn sáng và micro còn nghe sau khi người chơi
       * đã ra khỏi ván. Và báo server để người khác không ôm ô đen của mình.
       */
      sendRef.current(TYPE_ID.CallLeave);
      s.dispose();
      session.current = null;
      setStreams({});
      setFailed({});
      setLocalStream(null);
      setMic(false);
      setCam(false);
    };
  }, [enabled, myId, seatToken]);

  /* ── gói 100 đổi, hoặc danh sách ghế đổi -> tính lại lưới kết nối ──────── */
  useEffect(() => {
    void session.current?.applyState(members, idsRef.current);
  }, [members, allPlayerIds]);

  /* ── nút bấm ───────────────────────────────────────────────────────────── */
  const apply = useCallback(async (nextMic: boolean, nextCam: boolean) => {
    const s = session.current;
    if (!s) return;

    const real = await s.setPublishing(nextMic, nextCam);
    setMic(real.mic);
    setCam(real.cam);
    setLocalStream(s.localStream);

    /* Hai cờ tắt = rời hẳn; server gỡ khỏi danh sách và báo cả phòng. */
    if (!real.mic && !real.cam) sendRef.current(TYPE_ID.CallLeave);
    else sendRef.current(TYPE_ID.CallJoin, { Mic: real.mic, Cam: real.cam });

    /* Đổi việc mình có phát hay không làm đổi cả lưới - người chỉ xem cũng cần nối tới mình. */
    void s.applyState(members, idsRef.current);
  }, [members]);

  const toggleMic = useCallback(() => void apply(!mic, cam), [apply, mic, cam]);
  const toggleCam = useCallback(() => void apply(mic, !cam), [apply, mic, cam]);

  /* ── ducking: có ai nói thì hạ nhạc nền ────────────────────────────────── */
  useEffect(() => {
    if (!enabled || members.length === 0) {
      setSpeaking(false);
      return;
    }
    /*
     * 400 ms là chỗ đứng giữa: nhanh đủ để nhạc lùi ngay khi có người mở lời, mà không phải
     * gọi `getStats` liên tục làm nóng máy.
     */
    const id = setInterval(async () => {
      const s = session.current;
      if (!s) return;
      if (await s.someoneSpeaking()) lastHeard.current = Date.now();
      /*
       * ⚠️ GIỮ CỜ THÊM MỘT NHỊP sau khi hết tiếng. Bỏ độ trễ này thì **khoảng lặng giữa hai
       * từ** cũng tính là "nói xong", và nhạc nền nhấp nháy hơn chục lần trong một câu — đã đo
       * được trên hai máy thật 24/9. Tony muốn nhạc lùi *cho đến khi nói xong*, không phải lùi
       * theo từng âm tiết.
       */
      setSpeaking(Date.now() - lastHeard.current < SPEAK_HOLD_MS);
    }, 400);
    return () => clearInterval(id);
  }, [enabled, members.length]);

  /* ── đường gói tin ĐI VÀO, màn ván gọi khi nhận 99 / 100 ───────────────── */
  const onState = useCallback((next: CallMember[]) => setMembers(next ?? []), []);
  const onSignal = useCallback((from: string, data: string) => {
    void session.current?.onSignal(from, data);
  }, []);

  return { members, streams, failed, localStream, mic, cam, toggleMic, toggleCam, speaking, onState, onSignal };
}
