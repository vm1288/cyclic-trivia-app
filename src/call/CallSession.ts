import {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';

import { getIceServers } from '../api/call';

/**
 * K145 — LÕI CUỘC GỌI: quản một lưới **mesh** WebRTC giữa những người trong ván.
 *
 * <b>Vì sao mesh chứ không SFU:</b> ô video chỉ 50×50 dp nên gửi ~180×180 @ 12-15 fps là đủ nét
 * (~100 kbps/luồng). Ở cỡ đó, 6 người × 5 luồng vẫn nằm trong sức của điện thoại tầm trung và
 * KHÔNG tốn tiền máy chủ trung chuyển. Nếu sau này muốn video to thì mới phải đổi sang SFU.
 *
 * <b>Ai gọi trước:</b> so `playerId` theo thứ tự chuỗi, **id nhỏ hơn tạo offer**. Quy tắc này
 * tất định và cả hai bên tự suy ra được, nên không bao giờ có hai offer đâm nhau (glare) — thứ
 * gây ra kiểu hỏng "thỉnh thoảng một chiều không có hình" rất khó tái hiện.
 *
 * <b>Khi nào cần một kết nối:</b> giữa tôi và X, khi **tôi đang phát HOẶC X đang phát**. Người chỉ
 * xem vẫn cần kết nối để NHẬN. Cả hai bên tính cùng một biểu thức nên luôn đồng ý với nhau.
 *
 * ⚠️ Mọi thứ ở đây là việc RIÊNG của máy này. Nó không đụng gì tới luật ván: không gửi gói ván,
 * không chờ gói ván. Hỏng hết thì ván vẫn chạy.
 */

/** Một người đang phát, theo gói 100 `CallState`. */
export type CallMember = { PlayerId: string; Mic: boolean; Cam: boolean };

export type CallSessionOptions = {
  /** Ghế của chính máy này. */
  myId: string;
  seatToken: string;
  /** Gửi gói 99 lên server. */
  sendSignal: (to: string, data: string) => void;
  /** Có stream mới / mất stream của một ghế — màn hình vẽ lại. */
  onStream: (playerId: string, stream: MediaStream | null) => void;
  /** Đổi trạng thái nối của một ghế, để hiện "không kết nối được" thay vì ô đen. */
  onPeerState: (playerId: string, state: 'connecting' | 'connected' | 'failed') => void;
};

/** Offer gửi lâu hơn ngần này mà chưa có answer thì coi như đã rơi, được phép gửi lại. */
const OFFER_LOST_MS = 2000;

const same = (a: string, b: string) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

type Peer = {
  pc: RTCPeerConnection;
  /** Đã nhận `answer` chưa — để xếp hàng ICE tới sớm. */
  remoteReady: boolean;
  pendingIce: unknown[];
  /** Ta là bên tạo offer cho kết nối này (id nhỏ hơn). Quyết định ai đi thương lượng lại. */
  iOffer: boolean;
  /** Có thay đổi tới trong lúc đang thương lượng — làm nốt khi xong vòng này. */
  renegotiatePending: boolean;
  /** Hàng đợi xử lý tín hiệu của RIÊNG kết nối này — xem {@link onSignal}. */
  chain: Promise<void>;
  /** Lúc gửi offer gần nhất — để biết một offer đang bay đã **rơi mất** hay chưa. */
  offerSentAt: number;
};

export class CallSession {
  private readonly o: CallSessionOptions;
  private peers = new Map<string, Peer>();
  private local: MediaStream | null = null;
  private members: CallMember[] = [];
  private iceServers: unknown[] | null = null;
  /** Danh sách ghế của lần {@link applyState} gần nhất — để dựng lại kết nối hỏng mà không phải chờ gói mới. */
  private lastIds: string[] = [];
  private publishing = { mic: false, cam: false };
  private closed = false;

  constructor(options: CallSessionOptions) {
    this.o = options;
  }

  /* ── quyền phát của chính mình ─────────────────────────────────────────── */

  /**
   * Bật/tắt mic hoặc camera. Trả về trạng thái thật sau khi làm (xin quyền có thể bị từ chối).
   *
   * ⚠️ KHÔNG tạo `getUserMedia` mới mỗi lần bật tắt: đổi `track.enabled` trên stream đang có thì
   * đầu kia không phải thương lượng lại, hình/tiếng tắt bật tức thì. Chỉ khi chưa có stream nào
   * mới đi xin.
   */
  async setPublishing(mic: boolean, cam: boolean): Promise<{ mic: boolean; cam: boolean }> {
    if (this.closed) return this.publishing;

    if ((mic || cam) && !this.local) {
      try {
        this.local = (await mediaDevices.getUserMedia({
          audio: true,
          /* Ô hiển thị chỉ 50 dp — gửi to hơn là phí pin và băng thông của mọi người. */
          video: { width: 180, height: 180, frameRate: 15, facingMode: 'user' },
        })) as MediaStream;
      } catch {
        /* Người dùng từ chối quyền, hoặc máy không có camera/mic. */
        this.publishing = { mic: false, cam: false };
        return this.publishing;
      }
      /*
       * Stream mới thì mọi kết nối ĐANG MỞ phải được gắn track — và gắn xong PHẢI THƯƠNG
       * LƯỢNG LẠI (xem {@link renegotiate}).
       */
      this.peers.forEach((peer, key) => {
        if (this.attachLocal(peer)) void this.renegotiate(key, peer);
      });
    }

    this.local?.getAudioTracks().forEach((t) => (t.enabled = mic));
    this.local?.getVideoTracks().forEach((t) => (t.enabled = cam));
    this.publishing = { mic, cam };

    /* Tắt hết thì trả camera lại cho hệ thống - đèn camera còn sáng là người dùng hoảng. */
    if (!mic && !cam && this.local) {
      this.local.getTracks().forEach((t) => t.stop());
      this.local = null;

      /*
       * ⚠️ GỠ HẲN SENDER RA, không chỉ `stop()`. Track đã dừng mà còn nằm trong kết nối thì đầu kia
       * đứng lại ở **khung hình cuối cùng** — trông như người kia treo máy chứ không phải tắt camera.
       */
      this.peers.forEach((peer, key) => {
        const senders = peer.pc.getSenders().filter((sender) => sender.track);
        if (senders.length === 0) return;
        senders.forEach((sender) => {
          try {
            peer.pc.removeTrack(sender);
          } catch {
            /* kết nối đã đóng */
          }
        });
        void this.renegotiate(key, peer);
      });
    }
    return this.publishing;
  }

  get isPublishing() {
    return this.publishing.mic || this.publishing.cam;
  }

  get localStream() {
    return this.local;
  }

  /* ── danh sách người đang phát (gói 100) ───────────────────────────────── */

  /**
   * Nhận `CallState`. Mở kết nối còn thiếu, đóng kết nối không còn cần.
   * `allPlayerIds` là MỌI ghế trong ván, không chỉ người đang phát — người chỉ xem cũng cần nối.
   */
  async applyState(members: CallMember[], allPlayerIds: string[]) {
    if (this.closed) return;
    this.members = members ?? [];
    this.lastIds = allPlayerIds;

    const publishes = (id: string) => this.members.some((m) => same(m.PlayerId, id) && (m.Mic || m.Cam));
    const others = allPlayerIds.filter((id) => !same(id, this.o.myId));

    for (const id of others) {
      const needed = this.isPublishing || publishes(id);
      const have = this.peers.has(id.toLowerCase());

      if (needed && !have) await this.open(id);
      if (!needed && have) this.close(id);
    }

    /* Ai rời ván hẳn thì cũng phải dọn. */
    for (const id of Array.from(this.peers.keys())) {
      if (!others.some((o) => same(o, id))) this.close(id);
    }
  }

  /* ── tín hiệu (gói 99) ─────────────────────────────────────────────────── */

  /**
   * ⚠️ MỖI KẾT NỐI XỬ LÝ TÍN HIỆU TUẦN TỰ, không được chạy chồng nhau.
   *
   * Giữa `setRemoteDescription` và `setLocalDescription` có `await`; giữa hai nhịp đó mà một offer
   * nữa tới thì hai vòng đan vào nhau và vòng sau chết với
   * *"Failed to set local answer sdp: Called in wrong state: stable"*. Lúc đó kết nối vẫn "xanh"
   * nhưng **một chiều không có hình** — đã thấy thật trên máy 24/9.
   */
  async onSignal(from: string, raw: string) {
    if (this.closed) return;
    let msg: { sdp?: { type: string; sdp: string }; ice?: unknown; needOffer?: boolean };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    let peer = this.peers.get(from.toLowerCase());
    if (!peer) {
      /* Đối phương gọi trước khi ta kịp mở - vẫn phải nhận. */
      const opened = await this.open(from, /* offerIfMine */ false);
      if (!opened) return;
      peer = opened;
    }

    const current = peer;
    current.chain = current.chain.then(() => this.handleSignal(from, current, msg)).catch(() => {
      /* Một gói hỏng không được làm đứt hàng đợi của những gói sau. */
    });
    return current.chain;
  }

  private async handleSignal(
    from: string,
    peer: Peer,
    msg: { sdp?: { type: string; sdp: string }; ice?: unknown; needOffer?: boolean },
  ) {
    if (this.closed) return;

    /*
     * Đầu kia vừa thêm/bớt track và nhờ ta offer lại (xem {@link renegotiate}).
     *
     * Đang có một vòng chạy dở thì **bỏ qua lời nhờ này**, đừng đặt cọc: vòng đang bay đã mang
     * đủ mọi thứ rồi. Đặt cọc chỉ sinh ra một vòng thứ hai thừa, và hai vòng đan nhau là nguồn
     * của "một chiều không có hình".
     */
    if (msg.needOffer) {
      if (peer.pc.signalingState === 'stable') {
        await this.renegotiate(from, peer);
      } else if (peer.pc.localDescription && Date.now() - peer.offerSentAt > OFFER_LOST_MS) {
        /*
         * ⚠️ OFFER CŨ ĐÃ RƠI — GỬI LẠI CHÍNH NÓ.
         *
         * Đầu kia vừa mở lại app: offer ta gửi lúc nó chưa vào đã rơi vào khoảng không, nên ta
         * kẹt ở `have-local-offer` còn nó kẹt ở chờ. Bỏ qua lời nhờ này là **kẹt vĩnh viễn**
         * (đã dính thật 24/9). Gửi lại đúng `localDescription` đang có thì đầu kia trả lời được
         * ngay, không phải dựng lại gì.
         *
         * Mốc {@link OFFER_LOST_MS} để phân biệt với offer VẪN ĐANG BAY bình thường — gửi thêm
         * một bản nữa vào đúng lúc đó chỉ tạo ra một answer thứ hai vô duyên.
         */
        const local = peer.pc.localDescription;
        peer.offerSentAt = Date.now();
        this.o.sendSignal(from, JSON.stringify({ sdp: { type: local.type, sdp: local.sdp } }));
      }
      return;
    }

    if (msg.sdp) {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as never));
      peer.remoteReady = true;

      /* ICE tới trước SDP thì đã xếp hàng ở đây - giờ mới nạp được. */
      for (const ice of peer.pendingIce) await peer.pc.addIceCandidate(new RTCIceCandidate(ice as never));
      peer.pendingIce = [];

      if (msg.sdp.type === 'offer') {
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        this.o.sendSignal(from, JSON.stringify({ sdp: { type: answer.type, sdp: answer.sdp } }));
      }

      /* Vòng vừa xong; nếu có thay đổi đợi sẵn thì làm nốt bây giờ. */
      if (peer.renegotiatePending) await this.renegotiate(from, peer);
      return;
    }

    if (msg.ice) {
      /*
       * ⚠️ ICE tới TRƯỚC `setRemoteDescription` là chuyện bình thường, không phải lỗi.
       * Nạp sớm thì WebRTC ném và ứng viên đó mất luôn - đúng kiểu "một chiều không có hình".
       */
      if (!peer.remoteReady) peer.pendingIce.push(msg.ice);
      else await peer.pc.addIceCandidate(new RTCIceCandidate(msg.ice as never));
    }
  }

  /* ── vòng đời ──────────────────────────────────────────────────────────── */

  /** Gắn track của mình vào một kết nối. Trả về **có thêm track nào không** — có thì phải thương lượng lại. */
  private attachLocal(peer: Peer): boolean {
    if (!this.local) return false;
    const senders = peer.pc.getSenders();
    let added = false;
    this.local.getTracks().forEach((track) => {
      if (!senders.some((s) => s.track?.id === track.id)) {
        peer.pc.addTrack(track, this.local as never);
        added = true;
      }
    });
    return added;
  }

  /**
   * THƯƠNG LƯỢNG LẠI sau khi thêm hoặc bớt track trên một kết nối ĐÃ DỰNG XONG.
   *
   * ⚠️ THIẾU CÁI NÀY LÀ MẤT HÌNH, và mất đúng trong cách dùng thường gặp nhất (đã dính thật
   * trên hai máy ngày 24/9): A bật camera trước → B chỉ xem nên vẫn mở kết nối để nhận → lúc B
   * bật camera thì track được thêm vào một kết nối đã offer/answer xong rồi. Không ai offer lại
   * thì **A KHÔNG BAO GIỜ THẤY B**, tuy mọi thứ vẫn "xanh" ở cả hai bên.
   *
   * Ai offer lại: đúng bên đã offer lần đầu (id nhỏ hơn). Bên kia không tự offer — nó nhờ,
   * bằng `needOffer`. Giữ nguyên một chiều như vậy thì không bao giờ có hai offer đâm nhau.
   */
  private async renegotiate(remoteId: string, peer: Peer) {
    if (this.closed) return;
    /* Không phải bên tạo offer thì **nhờ**, không tự offer — giữ offer một chiều, không bao giờ glare. */
    if (!peer.iOffer) {
      this.o.sendSignal(remoteId, JSON.stringify({ needOffer: true }));
      return;
    }

    /*
     * Đang giữa một vòng khác thì ĐẶT CỜ rồi thoát, làm nốt khi vòng đó xong. Bỏ luôn là mất hình
     * đúng ở người bấm mic rồi bấm camera liền tay — hai thay đổi cách nhau một nhịp.
     */
    if (peer.pc.signalingState !== 'stable') {
      peer.renegotiatePending = true;
      return;
    }
    peer.renegotiatePending = false;

    try {
      const offer = await peer.pc.createOffer({});
      await peer.pc.setLocalDescription(offer);
      peer.offerSentAt = Date.now();
      this.o.sendSignal(remoteId, JSON.stringify({ sdp: { type: offer.type, sdp: offer.sdp } }));
    } catch {
      /* Kết nối rụng giữa chừng - `connectionstatechange` sẽ lo phần báo. */
    }
  }

  private async open(remoteId: string, offerIfMine = true): Promise<Peer | null> {
    const key = remoteId.toLowerCase();
    if (this.peers.has(key)) return this.peers.get(key)!;

    if (!this.iceServers) {
      /*
       * Lấy TỪ SERVER, không nhúng trong app: đổi/thêm TURN sau này chỉ là sửa cấu hình rồi
       * restart site, không phải ra bản app mới. Xem `TurnCredentialService` phía server.
       */
      this.iceServers = await getIceServers(this.o.seatToken);
    }

    const pc = new RTCPeerConnection({ iceServers: this.iceServers as never });
    const peer: Peer = {
      pc,
      remoteReady: false,
      pendingIce: [],
      iOffer: this.o.myId.toLowerCase() < key,
      renegotiatePending: false,
      chain: Promise.resolve(),
      offerSentAt: 0,
    };
    this.peers.set(key, peer);
    this.attachLocal(peer);

    // @ts-expect-error react-native-webrtc dùng sự kiện kiểu DOM; kiểu TS của nó chưa khớp
    pc.addEventListener('icecandidate', (e: { candidate: unknown }) => {
      if (e.candidate) this.o.sendSignal(remoteId, JSON.stringify({ ice: e.candidate }));
    });
    // @ts-expect-error - như trên
    pc.addEventListener('track', (e: { streams: MediaStream[] }) => {
      if (e.streams?.[0]) this.o.onStream(remoteId, e.streams[0]);
    });
    // @ts-expect-error - như trên
    pc.addEventListener('connectionstatechange', () => {
      const s = pc.connectionState;
      if (s === 'connected') this.o.onPeerState(remoteId, 'connected');
      else if (s === 'failed' || s === 'closed') {
        /*
         * K145: hỏng thì BÁO, đừng để ô đen. Người chơi thấy "không kết nối được" thì hiểu là
         * mạng; thấy ô đen thì tưởng app hỏng. Đây cũng là chỗ đếm tỉ lệ hỏng thật sau này.
         */
        this.o.onPeerState(remoteId, 'failed');

        /*
         * ⚠️ VÀ DỰNG LẠI HẴN MỘT KẾT NỐI MỚI, đừng cố cứu cái cũ.
         *
         * Một `RTCPeerConnection` đã `failed` có thể sống lại sau một lần ICE restart, nhưng
         * **`track` không bắn lại** — luồng hình về tới nơi mà màn hình không hề hay. Kết quả:
         * **một chiều có hình, chiều kia không**, và không bên nào báo lỗi (đã dính thật 24/9 khi
         * mở lại app một máy). Dựng mới thì mọi thứ đi lại từ đầu, không có trạng thái cũ sót.
         *
         * Đợi một nhịp rồi mới dựng: mạng rớt thật thì cả hai bên cùng hỏng một lúc, lao vào
         * dựng ngay là hai bên đạp nhau.
         */
        this.close(remoteId);
        setTimeout(() => {
          if (!this.closed) void this.applyState(this.members, this.lastIds);
        }, 3000);
      } else this.o.onPeerState(remoteId, 'connecting');
    });

    /* Id nhỏ hơn tạo offer - tất định, không bao giờ hai bên cùng offer. */
    if (offerIfMine && peer.iOffer) {
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      peer.offerSentAt = Date.now();
      this.o.sendSignal(remoteId, JSON.stringify({ sdp: { type: offer.type, sdp: offer.sdp } }));
    } else if (offerIfMine) {
      /*
       * ⚠️ KHÔNG ĐƯỢC CHỜ SUÔNG Ở ĐÂY. Ta không phải bên tạo offer, nhưng đầu kia có thể
       * đang giữ một kết nối CŨ tới ta — app ta vừa mở lại, hay vừa rớt mạng rồi vào lại. Khi đó
       * đầu kia thấy "đã có kết nối rồi" nên không offer nữa, còn ta thì ngồi đợi một offer
       * không bao giờ tới — **kẹt vĩnh viễn**, hai bên đều "xanh" (đã dính thật 24/9 khi mở
       * lại app trên một máy). Nhắc một tiếng thì đầu kia offer lại trên chính kết nối cũ của nó;
       * `ufrag` của ta mới nên đó cũng là một lần ICE restart, đúng thứ cần.
       */
      this.o.sendSignal(remoteId, JSON.stringify({ needOffer: true }));
    }
    return peer;
  }

  private close(remoteId: string) {
    const key = remoteId.toLowerCase();
    const peer = this.peers.get(key);
    if (!peer) return;
    try {
      peer.pc.close();
    } catch {
      /* đã đóng rồi */
    }
    this.peers.delete(key);
    this.o.onStream(remoteId, null);
  }

  /** Gỡ hết. Gọi khi rời màn ván — bỏ quên là camera còn sáng và micro còn nghe. */
  dispose() {
    this.closed = true;
    Array.from(this.peers.keys()).forEach((id) => this.close(id));
    this.local?.getTracks().forEach((t) => t.stop());
    this.local = null;
  }

  /**
   * Có ai đó đang NÓI không — để hạ nhạc nền (Tony 24/9: *"khi có ai nói thì nhạc nền nhỏ xuống
   * hoặc tắt cho đến khi nói xong"*).
   *
   * Đọc `audioLevel` của luồng đến qua `getStats`. Bản WebRTC nào không có trường đó thì rơi về
   * cách thô: coi như có tiếng khi có người bật mic. Thà hạ nhạc hơi thừa còn hơn nhạc đè lời nói.
   */
  async someoneSpeaking(threshold = 0.02): Promise<boolean> {
    if (this.peers.size === 0) return false;
    let sawLevel = false;

    for (const peer of Array.from(this.peers.values())) {
      try {
        const stats = await peer.pc.getStats();
        for (const report of (stats as unknown as Map<string, Record<string, unknown>>).values()) {
          if (report.type === 'inbound-rtp' && report.kind === 'audio' && typeof report.audioLevel === 'number') {
            sawLevel = true;
            if (report.audioLevel > threshold) return true;
          }
        }
      } catch {
        /* getStats hỏng thì coi như không biết */
      }
    }

    if (sawLevel) return false;
    return this.members.some((m) => m.Mic && !same(m.PlayerId, this.o.myId));
  }
}
