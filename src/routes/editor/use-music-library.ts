import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { describeMusicTags } from "../../../server/music-tags";

import { toast } from "@/components/ui/toast";
import { api, type ApiLibraryTrack } from "@/lib/api";

/**
 * Kho nhạc dùng chung: nạp danh sách, lọc, đánh dấu, nghe thử, tải thêm.
 *
 * Tách khỏi phần vẽ vì nó giữ khá nhiều trạng thái — nhất là thẻ `<audio>` để
 * nghe thử, thứ phải TẮT bài cũ trước khi mở bài mới, không thì hai bài chồng
 * tiếng lên nhau và người dùng không biết mình đang nghe cái nào.
 */
export function useMusicLibrary(open: boolean) {
  const [tracks, setTracks] = useState<ApiLibraryTrack[] | null>(null);
  const [error, setError] = useState("");
  const [tim, setTim] = useState("");
  const [chiSao, setChiSao] = useState(false);
  const [dangNghe, setDangNghe] = useState<string | null>(null);
  const [dangTai, setDangTai] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  const nap = useCallback(async () => {
    try {
      setTracks(await api.listMusicLibrary());
      setError("");
    } catch (loi) {
      setError(loi instanceof Error ? loi.message : "Không mở được kho nhạc");
    }
  }, []);

  // Chỉ nạp khi tab được MỞ RA. Kho có thể hàng trăm bài, mà phần lớn lượt dựng
  // không ai mở tới nó — nạp sẵn là tốn một lượt gọi cho mọi người để phục vụ
  // một số ít.
  useEffect(() => {
    if (open && tracks === null) void nap();
  }, [open, tracks, nap]);

  // Rời tab thì TẮT tiếng. Không tắt thì nhạc chạy tiếp trong lúc người dùng đã
  // sang bàn dựng và đang nghe lời — hai thứ chồng nhau mà không thấy nút nào.
  useEffect(() => {
    if (open) return;
    audio.current?.pause();
    audio.current = null;
    setDangNghe(null);
  }, [open]);

  const ngheThu = useCallback(
    (file: string) => {
      if (dangNghe === file) {
        audio.current?.pause();
        audio.current = null;
        setDangNghe(null);
        return;
      }
      audio.current?.pause();
      const el = new Audio(`/files/music/${encodeURIComponent(file)}`);
      // Nghe thử thôi, không phải nghe nhạc: để to bằng bản gốc thì nó át hẳn
      // giọng đang phát ở khung xem bên cạnh.
      el.volume = 0.5;
      el.onended = () => setDangNghe(null);
      void el.play().catch(() => {
        setError(
          "Trình duyệt chưa cho phát — bấm vào trang một cái rồi thử lại",
        );
        setDangNghe(null);
      });
      audio.current = el;
      setDangNghe(file);
    },
    [dangNghe],
  );

  const danhDau = useCallback(async (file: string, on: boolean) => {
    // Đổi trên màn NGAY rồi mới gửi: bấm sao mà phải chờ mạng thì cảm giác như
    // nút hỏng, và đây là việc gần như không bao giờ thất bại.
    setTracks((cur) =>
      cur ? cur.map((t) => (t.file === file ? { ...t, starred: on } : t)) : cur,
    );
    try {
      await api.starMusic(file, on);
    } catch {
      setTracks((cur) =>
        cur
          ? cur.map((t) => (t.file === file ? { ...t, starred: !on } : t))
          : cur,
      );
      toast.add({ title: "Không lưu được dấu sao", type: "error" });
    }
  }, []);

  const taiLenKho = useCallback(
    async (file: File, title: string, tags: string) => {
      setDangTai(true);
      try {
        const them = await api.uploadToMusicLibrary(file, title, tags);
        setTracks((cur) => (cur ? [them, ...cur] : [them]));
        toast.add({
          title: `Đã thêm “${them.title}” vào kho`,
          type: "success",
        });
        return true;
      } catch (loi) {
        toast.add({
          title: loi instanceof Error ? loi.message : "Không tải lên được",
          type: "error",
        });
        return false;
      } finally {
        setDangTai(false);
      }
    },
    [],
  );

  /** Mọi thẻ đang có, để bày thành hàng nút lọc. */
  const moiThe = useMemo(() => {
    const dem = new Map<string, number>();
    for (const track of tracks ?? []) {
      // Ba trục nhãn đứng ĐẦU danh sách thẻ: chúng là thứ duy nhất phủ hết kho,
      // nên lọc theo chúng luôn cho ra một tập dùng được, còn thẻ tự do thì có
      // cái chỉ dính đúng một bài.
      for (const the of [
        ...describeMusicTags(track.labels).split(" · ").filter(Boolean),
        ...track.tags,
      ]) {
        dem.set(the, (dem.get(the) ?? 0) + 1);
      }
    }
    return [...dem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([the]) => the);
  }, [tracks]);

  const hien = useMemo(() => {
    const tu = tim.trim().toLowerCase();
    return (tracks ?? []).filter((track) => {
      if (chiSao && !track.starred) return false;
      if (!tu) return true;
      return (
        track.title.toLowerCase().includes(tu) ||
        track.tags.some((the) => the.toLowerCase().includes(tu)) ||
        // Ba trục nhãn tìm được bằng chính ô tìm đang có ("mạnh", "êm", "dày"),
        // không thêm một hàng nút lọc thứ hai. Ô tìm đã ở đúng chỗ và đã có
        // thói quen dùng; thêm control cho một trục nữa là bắt người dùng học
        // hai cách lọc cho cùng một việc.
        describeMusicTags(track.labels).toLowerCase().includes(tu)
      );
    });
  }, [tracks, tim, chiSao]);

  return {
    tracks,
    hien,
    moiThe,
    error,
    tim,
    setTim,
    chiSao,
    setChiSao,
    dangNghe,
    ngheThu,
    danhDau,
    taiLenKho,
    dangTai,
    nap,
  };
}
