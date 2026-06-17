'use client'

import { useSyncExternalStore } from 'react'

// Read the current theme straight from the DOM class (the source of truth set
// pre-paint by the inline script in app/layout.js). useSyncExternalStore is the
// idiomatic way to read external/DOM state without a hydration mismatch.
function subscribe(callback) {
  window.addEventListener('themechange', callback)
  return () => window.removeEventListener('themechange', callback)
}

function getSnapshot() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

// null on the server (and first hydration pass) so we render a neutral button.
function getServerSnapshot() {
  return null
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    localStorage.setItem('theme', next)
    window.dispatchEvent(new Event('themechange'))
  }

  return (
    <button
      type='button'
      onClick={toggle}
      aria-label='Toggle dark mode'
      className='flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
    >
      {theme === 'dark' ? (
        // Sun
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='18'
          height='18'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          aria-hidden='true'
        >
          <circle cx='12' cy='12' r='4' />
          <path d='M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41' />
        </svg>
      ) : (
        // Moon
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='18'
          height='18'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          aria-hidden='true'
        >
          <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' />
        </svg>
      )}
    </button>
  )
}
