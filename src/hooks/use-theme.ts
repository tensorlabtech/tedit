import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'

/**
 * Chưa chọn gì thì NỀN TỐI, không phải bám theo hệ điều hành.
 *
 * Đây là bàn dựng video: khung hình là vật sáng duy nhất trên màn, còn giao
 * diện là bóng tối quanh nó. Mở ra gặp nền trắng thì màu của chính đoạn phim
 * đang dựng bị nền lấn.
 *
 * "Hệ thống" vẫn chọn được, nhưng phải chọn — nên nó cũng được LƯU lại thay vì
 * xoá khoá như trước: xoá khoá thì "đã chọn hệ thống" và "chưa chọn gì" trông
 * giống hệt nhau, mà giờ hai thứ đó dẫn tới hai kết quả khác nhau.
 */
function readStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'dark'
}

function prefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Quản lý giao diện sáng/tối: lưu lựa chọn và bám theo hệ điều hành khi để 'system'
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    const apply = () => {
      const isDark = theme === 'dark' || (theme === 'system' && prefersDark())
      document.documentElement.classList.toggle('dark', isDark)
    }

    apply()

    if (theme !== 'system') {
      return
    }

    // Đang theo hệ điều hành thì đổi luôn khi người dùng đổi cài đặt máy
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }, [])

  return { theme, setTheme }
}
