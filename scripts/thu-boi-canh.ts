/**
 * In ra lời nhắc THẬT mà mỗi chặng AI nhận, để đọc bằng mắt.
 *
 *   npx tsx scripts/thu-boi-canh.ts
 *
 * Lời nhắc là thứ quyết định chất lượng mọi chặng chọn lựa, mà nó lại vô hình:
 * không có màn nào bày ra, không có test nào đọc. In ra là cách rẻ nhất để
 * thấy mô hình đang được cho biết những gì — và những gì nó KHÔNG được cho
 * biết.
 */
import { db } from "../server/db";
import { boiCanhDuAn } from "../server/ai-context";

const rows = db
  .prepare("SELECT id, title, profile FROM projects ORDER BY created_at DESC LIMIT 5")
  .all() as Array<{ id: string; title: string | null; profile: string | null }>;

if (rows.length === 0) console.log("chưa có dự án nào");

for (const row of rows) {
  const boiCanh = boiCanhDuAn(row.id);
  console.log(`── ${row.id}  "${row.title ?? ""}"`);
  console.log(boiCanh ? boiCanh.split("\n").map((l) => "   " + l).join("\n") : "   (không có bối cảnh — mô hình làm việc mù)");
  console.log();
}
