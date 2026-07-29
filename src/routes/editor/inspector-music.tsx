import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";

import { type MusicTrack } from "./editor-data";
import type { EditorState } from "./use-editor";

/** Trần âm lượng: quá 60% là nhạc nuốt mất giọng nói, không phải làm nền nữa. */
const MAX_VOLUME = 0.6;

export function MusicInspector({
  track,
  editor,
}: {
  track: MusicTrack;
  editor: EditorState;
}) {
  return (
    <Card className="h-full min-h-0">
      <CardHeader>
        <CardTitle>Nhạc nền</CardTitle>
        <CardAction>
          <Badge variant="secondary">
            {(track.end - track.start).toFixed(1)} giây
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <div className="grid gap-3">
          <p className="truncate text-sm" title={track.name}>
            {track.name}
          </p>
          <Field>
            <FieldLabel>Âm lượng</FieldLabel>
            <div className="flex items-center gap-3">
              <Slider
                aria-label="Âm lượng nhạc nền"
                className="flex-1"
                min={0}
                max={MAX_VOLUME}
                step={0.02}
                value={[track.volume]}
                onValueChange={(value) =>
                  editor.setMusicVolume(
                    track.id,
                    Array.isArray(value) ? value[0] : value,
                  )
                }
              />
              <span className="w-9 text-right text-sm tabular-nums">
                {Math.round(track.volume * 100)}%
              </span>
            </div>
            {/* Chỉ nói khi ĐÃ kịch thang. In sẵn "thang dừng ở 60% vì trên đó
                nhạc nuốt mất giọng" thì câu ấy đứng đó cả buổi trong khi mặc
                định là 18% — chẳng ai chạm tới trần.

                Cũng bỏ hẳn đoạn "kéo hai đầu khối trên dải để đổi chỗ nhạc":
                chọn nhạc là hai tay nắm hiện ra ngay trên dải, tự nó chỉ đường.
                Và câu "bỏ bớt quãng video thì nhạc tự dồn lên" tả một việc chạy
                đúng mà không cần ai biết. */}
            {track.volume >= MAX_VOLUME - 0.001 && (
              <FieldDescription>
                Kịch thang — trên mức này nhạc nuốt mất giọng nói
              </FieldDescription>
            )}
          </Field>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void editor.removeMusic(track.id)}
        >
          <Trash2Icon data-icon="inline-start" />
          Gỡ nhạc này
        </Button>
      </CardFooter>
    </Card>
  );
}
