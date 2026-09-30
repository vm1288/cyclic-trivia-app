/**
 * iOS (30/9): quầng sáng của chữ (`textShadowRadius`) bị CẮT theo khung dòng chữ. Khung ôm sát
 * chữ thì quầng sáng thành một HỘP mờ sau chữ - thấy rõ ở tiêu đề JOIN, "WHO GOES FIRST?", số
 * đếm ngược. Android không cắt.
 *
 * `...glowRoom(r)` nới khung chữ ra đủ chỗ cho quầng sáng rồi bù bằng margin âm đúng bằng thế:
 * kích thước CHIẾM CHỖ trong bố cục không đổi, chỉ vùng vẽ được rộng ra. Style đã có sẵn
 * `marginTop`/`marginBottom` thì trừ thêm `glowPad(r)` vào đó (spread đặt TRƯỚC các margin riêng).
 */
export const glowPad = (radius: number) => Math.ceil(radius) + 2;

export const glowRoom = (radius: number) => {
  const p = glowPad(radius);
  return { paddingHorizontal: p, paddingVertical: p, marginHorizontal: -p, marginVertical: -p } as const;
};
