import { buttonsSections } from '@/dev/design-system/sections/buttons-sections'
import { formControlsSections } from '@/dev/design-system/sections/form-controls-sections'
import { formInputsSections } from '@/dev/design-system/sections/form-inputs-sections'
import { selectionSections } from '@/dev/design-system/sections/selection-sections'
import { overlaySections } from '@/dev/design-system/sections/overlay-sections'
import { menuSections } from '@/dev/design-system/sections/menu-sections'
import { disclosureSections } from '@/dev/design-system/sections/disclosure-sections'
import { layoutSections } from '@/dev/design-system/sections/layout-sections'
import { navigationSections } from '@/dev/design-system/sections/navigation-sections'
import { dataDisplaySections } from '@/dev/design-system/sections/data-display-sections'
import { statusSections } from '@/dev/design-system/sections/status-sections'
import { cardSections } from '@/dev/design-system/sections/card-sections'
import { chatSections } from '@/dev/design-system/sections/chat-sections'
import { feedbackSections } from '@/dev/design-system/sections/feedback-sections'
import type { ShowcaseGroup } from '@/dev/design-system/showcase-types'

// Toàn bộ component được nhóm theo mục đích sử dụng
export const showcaseGroups: ShowcaseGroup[] = [
  { id: 'actions', title: 'Hành động', sections: buttonsSections },
  { id: 'form-inputs', title: 'Nhập liệu', sections: formInputsSections },
  { id: 'form-controls', title: 'Điều khiển form', sections: formControlsSections },
  { id: 'selection', title: 'Chọn lựa', sections: selectionSections },
  { id: 'overlays', title: 'Lớp phủ', sections: overlaySections },
  { id: 'menus', title: 'Menu', sections: menuSections },
  { id: 'navigation', title: 'Điều hướng', sections: navigationSections },
  { id: 'layout', title: 'Bố cục', sections: layoutSections },
  { id: 'disclosure', title: 'Đóng mở nội dung', sections: disclosureSections },
  { id: 'data-display', title: 'Hiển thị dữ liệu', sections: [...cardSections, ...dataDisplaySections] },
  { id: 'status', title: 'Trạng thái', sections: statusSections },
  { id: 'chat', title: 'Hội thoại', sections: chatSections },
  { id: 'feedback', title: 'Phản hồi & dữ liệu', sections: feedbackSections },
]
