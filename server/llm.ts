/**
 * Cửa duy nhất gọi mô hình — qua OpenRouter.
 *
 * Một cửa nên đổi nhà cung cấp chỉ phải sửa tệp này: tám chặng AI đều gọi
 * `ask()` và không chặng nào biết mình đang nói chuyện với ai.
 *
 * Dùng `fetch` thẳng chứ không kéo SDK: chỗ này chỉ cần một lời gọi có kiểu trả
 * về chặt, mà SDK thì thêm một tầng phải theo phiên bản.
 */
import { cacheKey, readCache, writeCache } from "./llm-cache";

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
 * cần suy luận thật.
 *
 * ══ VÌ SAO HIỆN GIỜ CẢ HAI BẬC ĐỀU LÀ V4-PRO ══
 *
 * Đo trên một dự án thật, chặng chọn từ nhấn, đếm ĐỀ XUẤT BỊ GẠT (mô hình đưa
 * ra rồi bị loại vì bịa mã hoặc đề xuất thừa):
 *
 *   gpt-5      107 · 41 · 32 · 28   ← bốn lượt, dao động rất rộng
 *   v4-flash    46                  ← nằm gọn trong dải trên, không nói lên gì
 *   v4-pro       4                  ← thấp hơn cả sàn của gpt-5 bảy lần
 *
 * Bốn lượt gpt-5 cho biết dải nhiễu là 28–107. Chỉ `v4-pro` ra ngoài hẳn dải
 * ấy, nên nó là dấu hiệu chứ không phải xúc xắc — và nhìn trên khung hình cũng
 * khớp: nó nhấn danh từ mang nghĩa ở những chỗ gpt-5 bỏ trống.
 *
 * `v4-flash` bị loại vì không có bằng chứng nào nó khá hơn, mà lại CHẬM hơn cả
 * gpt-5 (34,7 giây một lượt gọi so với 12,8–18). Lợi thế duy nhất là giá, mà
 * `v4-pro` cũng đã rẻ hơn gpt-5 11,5 lần rồi.
 *
 * Giá phải trả là 78 giây một lượt gọi. Chịu được vì `llm-cache.ts` khiến giá
 * ấy chỉ trả MỘT LẦN cho mỗi bản chép — chỉnh đồ hoạ hay xuất lại sau đó không
 * gọi mô hình lần nào (đo: hai lượt dựng liên tiếp ra hai tệp giống nhau từng
 * byte, lượt sau 0 giây mô hình).
 *
 * ══ CHỖ CHƯA BIẾT ══
 *
 * Mới đo hai trên bảy chặng. Bốn chặng nặng suy luận chưa thử, và đáng lo nhất
 * là `ai-fix-transcript` — lỗi chính tả là thứ người xem thấy ngay. Giữ hai bậc
 * riêng chính là để hạ riêng một chặng về gpt-5 nếu cần, không phải đổi cả bộ.
 */
const MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-pro";
const MODEL_CHEAP =
  process.env.OPENROUTER_MODEL_CHEAP ?? process.env.OPENROUTER_MODEL ?? MODEL;

/**
 * Mô hình cho lời gọi CÓ ẢNH (mô tả tư liệu chèn).
 *
 * `MODEL`/`MODEL_CHEAP` mặc định là deepseek — thuần chữ, KHÔNG nhận ảnh: lời gọi
 * kèm ảnh trả về "No endpoints found that support image input", nên cả chặng mô
 * tả tư liệu hỏng lặng lẽ (`describeInserts` nuốt lỗi) và b-roll không bao giờ
 * đặt được. Tách riêng một mô hình nhìn được ảnh cho đúng những lời gọi cần nó.
 */
const MODEL_VISION =
  process.env.OPENROUTER_MODEL_VISION ?? "openai/gpt-4o-mini";

/** Hạt giống gửi kèm mọi lời gọi — xem chú thích ở chỗ dựng thân yêu cầu. */
const SEED = Number(process.env.OPENROUTER_SEED ?? 7);

/**
 * Tổng thời gian NẰM CHỜ mô hình trong một lượt dựng, và gọi bao nhiêu lần.
 *
 * Cần vì không ai biết mô hình chiếm bao nhiêu trong hai mươi phút dựng — mà
 * không biết thì mọi câu "đổi mô hình cho nhanh hơn" đều là đoán.
 */
export const modelSpend = { calls: 0, ms: 0 };
export { cacheSpend } from "./llm-cache";

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
    // Có ảnh thì BẮT BUỘC dùng mô hình nhìn được ảnh, bất kể `cheap`.
    model: options.images?.length
      ? MODEL_VISION
      : options.cheap
        ? MODEL_CHEAP
        : MODEL,
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
    /*
     * HẠT GIỐNG — gửi kèm, nhưng ĐỪNG tin nó cho tính lặp lại.
     *
     * Thêm vào để hai lượt dựng cùng dữ liệu ra cùng một video. Đo thì KHÔNG:
     * hai lượt gpt-5 cùng seed 7 ra "3 lượt · gạt 107" và "2 lượt · gạt 41",
     * tệp lệch nhau 10 MB. Thử thẳng vào API cũng thế — cùng seed, cùng nhà
     * cung cấp (OpenAI), hai danh sách từ khác nhau.
     *
     * Mô hình suy luận sinh phần suy luận không nằm dưới quyền hạt giống, và
     * suy luận mới là thứ lái kết quả. Giữ lại vì không tốn gì và có nhà cung
     * cấp khác tôn trọng nó — nhưng thứ thật sự cho lặp lại được là LƯU LẠI câu
     * trả lời theo (mô hình, chặng, vân tay đầu vào), không phải hạt giống.
     */
    seed: SEED,
    // Chỉ gửi khi chỗ gọi có ý kiến. Gửi kèm một mức mặc định do mình chọn là
    // âm thầm đổi hành vi của cả bảy chặng còn lại.
    ...(options.effort ? { reasoning: { effort: options.effort } } : {}),
  };

  /*
   * Hỏi bộ nhớ đệm TRƯỚC khi hỏi mô hình.
   *
   * Đây mới là thứ cho lặp lại được — `seed` đo ra không cho (xem chú thích ở
   * chỗ dựng thân yêu cầu). Khoá phủ mọi thứ đi vào câu trả lời, nên trúng
   * nghĩa là đúng câu hỏi ấy đã hỏi rồi.
   */
  const key = cacheKey({
    model: body.model,
    schemaName: options.schemaName,
    instructions: options.instructions,
    input: options.input,
    images: options.images ?? [],
    effort: options.effort,
  });
  const saved = readCache(key);
  if (saved !== null) return saved as T;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    try {
      const began = Date.now();
      try {
        const value = extractJson(await call(body));
        writeCache(key, value, body.model);
        return value as T;
      } finally {
        modelSpend.calls += 1;
        modelSpend.ms += Date.now() - began;
      }
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
