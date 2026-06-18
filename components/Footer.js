const year = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className='mx-auto flex max-w-[760px] items-center justify-between px-8 py-8 font-mono text-[11px] tracking-[0.06em] text-muted uppercase'>
      <span>© {year} Bjorn Hansen</span>
      <a
        href='https://bjornhansen.dev'
        className='transition-colors hover:text-brand'
      >
        bjornhansen.dev
      </a>
    </footer>
  )
}
