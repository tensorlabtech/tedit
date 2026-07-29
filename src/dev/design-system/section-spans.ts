import type { ShowcaseSpan } from '@/dev/design-system/showcase-types'

// Bề rộng ô bento của từng component, chọn theo bề ngang nội dung demo
// và số trường hợp cần bày. Không khai báo ở đây nghĩa là chiếm 1 cột.
const sectionSpans: Record<string, ShowcaseSpan> = {
  // Rất nhiều trường hợp hoặc nội dung rất rộng
  card: 3,
  button: 3,
  table: 3,
  calendar: 3,
  chart: 3,

  // Nội dung rộng vừa, đủ chỗ bày hai cột trường hợp
  field: 2,
  select: 2,
  command: 2,
  item: 2,
  empty: 2,
  alert: 2,
  avatar: 2,
  'input-group': 2,
  accordion: 2,
  tabs: 2,
  carousel: 2,
  resizable: 2,
  message: 2,
  bubble: 2,
  attachment: 2,
  'message-scroller': 2,
  toast: 2,
}

export function getSectionSpan(sectionId: string): ShowcaseSpan {
  return sectionSpans[sectionId] ?? 1
}
