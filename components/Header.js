import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

export default function Header() {
  return (
    <header className='border-b border-line'>
      <div className='mx-auto flex max-w-[760px] items-center justify-between px-8 py-[26px]'>
        <Link
          href='/'
          className='font-serif text-[22px] font-medium tracking-[-0.01em]'
        >
          Bjorn Hansen
        </Link>
        <nav className='flex items-center gap-6 font-mono text-xs tracking-[0.04em] text-ink-70 uppercase'>
          <Link href='#work' className='transition-colors hover:text-brand'>
            Work
          </Link>
          <Link
            href='#background'
            className='transition-colors hover:text-brand'
          >
            Background
          </Link>
          <Link href='#contact' className='transition-colors hover:text-brand'>
            Contact
          </Link>
          <a
            href='https://www.linkedin.com/in/bjornmhansen/'
            target='_blank'
            rel='noreferrer'
            className='font-medium text-brand transition-opacity hover:opacity-80'
          >
            LinkedIn
          </a>
          <a
            href='https://github.com/bjornhansen'
            target='_blank'
            rel='noreferrer'
            className='font-medium text-brand transition-opacity hover:opacity-80'
          >
            GitHub
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
