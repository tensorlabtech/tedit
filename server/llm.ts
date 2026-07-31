/**
 * Cửa duy nhất gọi mô hình — qua OpenRouter.
 *
 * Một cửa nên đổi nhà cung cấp chỉ phải sửa tệp này: tám chặng AI đều gọi
 * `ask()` và không chặng nào biết mình đang nói chuyện với ai.
 *
 * Dùng `fetch` thẳng chứ không kéo SDK: chỗ này chỉ cần một lời gọi có kiểu trả
 * về chặt, mà SDK thì thêm một tầng phải theo phiên bản.
 */

// Nạp `.env`. Việc này nằm ở `env.ts` chứ không làm tại đây: bản trước gọi
// `process.loadEnvFile(".env")`, tức là giải theo THƯ MỤC ĐANG ĐỨNG — chạy bằng
// systemd hay từ thư mục cha là không đọc được tệp nào, mà hàm đó không báo lỗi
// khi thiếu tệp nên `hasModel()` lặng lẽ trả false và cả tám chặng AI bị bỏ qua
// như thể người dùng chưa từng đặt khoá.
import "./env";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Hai bậc mô hình.
 *
 * Không phải chặng nào cũng cần mô hình đắt nhất: mô tả một tấm ảnh hay chọn
 * một trong năm bài nhạc thì bậc rẻ làm được, còn sửa lời và đặt tư liệu mới
 * cần suy luận thật. Chênh lệch giá giữa hai bậc là bốn tới năm lần.
 */
const MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-5";
const MODEL_CHEAP =
  process.env.OPENROUTER_MODEL_CHEAP ?? process.env.OPENROUTER_MODEL ?? MODEL;

/** Chờ tối đa cho một lời gọi. Treo vô hạn thì cả lượt dựng đứng im không lý do. */
const TIMEOUT_MS = 120_000;
/** Số lần thử lại khi mô hình trả về thứ không phải JSON. Xem chú thích ở `ask`. */
const MAX_TRIES = 3;

export function hasModel() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export type ImagePart = { mimeType: string; base64: string };

type Choice = { message?: { content?: string } };

async function call(body: unknown): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        // OpenRouter dùng hai trường này để xếp hạng ứng dụng; không bắt buộc
        // nhưng gửi kèm thì bảng thống kê bên họ đọc ra được là ai gọi.
        "HTTP-Referer": "https://teddit.local",
        "X-Title": "teddit",
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timer);
  }

  const data = (await response.json()) as {
    error?: { message: string };
    choices?: Choice[];
  };
  if (data.error) throw new Error(`Mô hình lỗi: ${data.error.message}`);
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Mô hình trả về rỗng");
  return text;
}

/**
 * Gỡ JSON ra khỏi câu trả lời.
 *
 * OpenAI ở chế độ `strict` bảo đảm trả đúng schema, nhưng OpenRouter thì KHÔNG
 * đồng đều: hỗ trợ tính theo endpoint chứ không theo model, và tài liệu của họ
 * nói rõ có nhà cung cấp chỉ coi schema là "gợi ý mạnh". Nên phải chấp nhận
 * chuyện thỉnh thoảng nhận về một khối JSON bọc trong dấu nháy ba, và phải gỡ
 * được thay vì gãy cả chặng vì một dấu ngoặc.
 */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* thử tiếp bên dưới */
  }
  // Khối ```json ... ``` hoặc chữ dẫn trước dấu ngoặc đầu tiên.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.search(/[[{]/);
  const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
  if (start === -1 || end <= start) throw new Error("Không đọc được JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Hỏi mô hình và nhận về đúng một vật theo `schema`.
 *
 * `images` để trống là lời gọi thuần chữ. `cheap` chọn bậc mô hình rẻ — dùng cho
 * việc không cần suy luận sâu.
 *
 * Thử lại tối đa `MAX_TRIES` lần khi không đọc được JSON: một lượt dựng chạy vài
 * phút, hỏng ở chặng cuối chỉ vì một câu trả lời méo là quá đắt so với việc hỏi
 * lại một lần.
 */
export async function ask<T>(options: {
  instructions: string;
  input: string;
  schema: Record<string, unknown>;
  schemaName: string;
  images?: ImagePart[];
  cheap?: boolean;
  /**
   * Mức SUY LUẬN của mô hình. Bỏ trống là để nhà cung cấp tự chọn.
   *
   * Đây là núm vặn thời gian lớn nhất ở đây, lớn hơn cả kích thước dữ liệu gửi
   * đi. Đo trên chặng sửa lời, cùng một bản chép 221 từ:
   *
   *   để mặc định  48,6s  ·  3.904 token suy luận
   *   low          24,9s  ·  1.600
   *   minimal       3,6s  ·      0
   *
   * Thời gian bám gần như tuyến tính vào số token suy luận — dữ liệu gửi lên chỉ
   * có 6,6KB nên không phải chỗ tốn.
   */
  effort?: "minimal" | "low" | "medium" | "high";
}): Promise<T> {
  if (!hasModel()) throw new Error("Chưa có OPENROUTER_API_KEY");

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: options.input },
  ];
  for (const image of options.images ?? []) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
    });
  }

  const body = {
    model: options.cheap ? MODEL_CHEAP : MODEL,
    messages: [
      { role: "system", content: options.instructions },
      { role: "user", content },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: options.schemaName,
        strict: true,
        schema: options.schema,
      },
    },
    // Chỉ định tuyến tới nhà cung cấp THẬT SỰ nhận `response_format`. Thiếu cờ
    // này thì OpenRouter có thể chọn một endpoint bỏ qua schema, và lỗi hiện ra
    // ở tận chỗ `JSON.parse` chứ không nói gì về nguyên nhân.
    provider: { require_parameters: true },
    // Chỉ gửi khi chỗ gọi có ý kiến. Gửi kèm một mức mặc định do mình chọn là
    // âm thầm đổi hành vi của cả bảy chặng còn lại.
    ...(options.effort ? { reasoning: { effort: options.effort } } : {}),
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    try {
      return extractJson(await call(body)) as T;
    } catch (error) {
      lastError = error as Error;
      // Hết quota hay sai khoá thì thử lại cũng vô ích — hỏng luôn cho nhanh.
      if (/quota|credit|api key|unauthorized/i.test(lastError.message)) break;
    }
  }
  throw lastError ?? new Error("Mô hình lỗi");
}

/**
 * Bắt buộc cho mọi `object` trong schema ở chế độ `strict`.
 *
 * Thiếu `additionalProperties: false` hoặc thiếu một khoá trong `required` là
 * API từ chối thẳng, và lời báo lỗi chỉ ra đường dẫn trong schema chứ không nói
 * thiếu cái gì — nên gói lại một chỗ cho khỏi quên.
 */
export function object(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}
