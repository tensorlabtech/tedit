import type { ReactNode } from 'react'

// Một trường hợp sử dụng cụ thể của component (variant, size, state...)
export type ShowcaseCase = {
  name: string
  node: ReactNode
}

// Một component trong design system, gồm nhiều trường hợp sử dụng
export type ShowcaseSection = {
  id: string
  title: string
  description?: string
  cases: ShowcaseCase[]
}

// Nhóm component theo mục đích sử dụng, dùng cho thanh điều hướng
export type ShowcaseGroup = {
  id: string
  title: string
  sections: ShowcaseSection[]
}

// Số cột mà một ô chiếm trong lưới bento
export type ShowcaseSpan = 1 | 2 | 3
