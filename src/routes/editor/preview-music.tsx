import { useEffect, useRef } from "react";

import type { MusicTrack } from "./editor-data";

/**
 * Nghe thử nhạc nền ngay trên bàn dựng.
 *
 * Không có nó thì chỉnh âm lượng là chỉnh mù: người dùng kéo thanh về 18% mà
 * không biết 18% nghe ra sao so với giọng nói, phải xuất cả video mới biết.
 *
 * Kim nhạc đặt theo THỜI GIAN GIỮ LẠI tính từ đầu bài, không theo hiệu số giây
 * thô — vì bản xuất ra cũng vậy. Bỏ một quãng giữa bài thì ở đây nhạc cũng phải
 * nhảy tới đúng chỗ đó, không thì canh xong xuất ra lại lệch.
 */
export function PreviewMusic({
  tracks,
  time,
  playing,
  keptSpan,
}: {
  tracks: MusicTrack[];
  time: number;
  /** Đang phát. Lượt NGHE THỬ phần đã cắt phải truyền `false` — xem chú thích dưới */
  playing: boolean;
  keptSpan: (from: number, to: number) => number;
}) {
  return (
    <>
      {tracks.map((track) => (
        <MusicVoice
          key={track.id}
          track={track}
          time={time}
          playing={playing}
          keptSpan={keptSpan}
        />
      ))}
    </>
  );
}

/** Lệch quá ngần này mới tua lại — gán `currentTime` mỗi khung là nhạc giật. */
const DRIFT = 0.3;

/**
 * Vì sao lượt nghe thử phần đã cắt phải TẮT nhạc.
 *
 * Kim nhạc đặt theo thời gian GIỮ LẠI, mà trong một quãng đã bỏ thì thời gian giữ
 * lại không nhích — nên kim đứng yên trong khi tệp vẫn chạy, và cứ quá `DRIFT` là
 * bị kéo giật về chỗ cũ. Nghe ra là một mẩu nhạc lặp suốt lượt nghe thử.
 *
 * Đẩy kim theo giờ thật cũng không đúng: quãng ấy KHÔNG có trong bản xuất nên nó
 * không có chỗ nào trên trục nhạc, mà đẩy xong thì lúc quay về phim kim lại phải
 * nhảy ngược đúng chừng ấy. Im lặng là câu trả lời thật thà nhất — người dùng đang
 * nghe xem chỗ CẮT nghe ra sao, và nhạc trở lại ngay khi vạch về lại phim.
 */

function MusicVoice({
  track,
  time,
  playing,
  keptSpan,
}: {
  track: MusicTrack;
  time: number;
  playing: boolean;
  keptSpan: (from: number, to: number) => number;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const inside = time >= track.start && time < track.end;

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.volume = Math.min(Math.max(track.volume, 0), 1);
  }, [track.volume]);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    if (!playing || !inside) {
      audio.pause();
      return;
    }
    // Bài ngắn hơn khoảng đặt thì lặp lại — giống `-stream_loop -1` lúc xuất.
    const want = keptSpan(track.start, time);
    const length = audio.duration;
    const at = Number.isFinite(length) && length > 0 ? want % length : want;
    if (Math.abs(audio.currentTime - at) > DRIFT) audio.currentTime = at;
    void audio.play().catch(() => {
      /* trình duyệt chưa cho phát trước khi người dùng chạm vào trang */
    });
  }, [playing, inside, time, track.start, keptSpan]);

  return <audio ref={ref} src={track.url} loop preload="auto" hidden />;
}
