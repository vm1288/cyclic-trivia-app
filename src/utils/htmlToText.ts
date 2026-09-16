/**
 * Chữ từ server có thể là HTML thật: câu hỏi / đáp án / giải thích / đề bài thử thách
 * được soạn cho trang web nên hay chứa `<br>` để xuống dòng, `<strong>`, `&amp;`…
 * (Tony 09-16: câu hỏi lời bài hát hiện nguyên chữ "<br>" trên app). App vẽ `Text`
 * thuần nên gỡ thẻ ở đây, một chỗ cho mọi khung.
 */
export const htmlToText = (raw: string | null | undefined): string =>
  (raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
