import Image from 'next/image'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

export default function Header() {
  return (
    <header className='mx-auto flex max-w-(--breakpoint-lg) flex-col items-center gap-4 px-4 py-5 sm:flex-row sm:justify-between'>
      <Link href='/' className='font-inter text-2xl font-extrabold'>
        Bjorn Hansen
      </Link>
      <div className='flex items-center gap-6'>
        <nav className='flex items-center gap-5 text-sm font-medium'>
          <Link href='#work' className='hover:text-brand dark:hover:text-brand-dark'>
            Work
          </Link>
          <Link href='#background' className='hover:text-brand dark:hover:text-brand-dark'>
            Background
          </Link>
          <Link href='#contact' className='hover:text-brand dark:hover:text-brand-dark'>
            Contact
          </Link>
        </nav>
        <div className='flex items-center gap-3'>
          <a
            href='https://www.linkedin.com/in/bjornmhansen/'
            target='_blank'
            aria-label='LinkedIn'
            className='opacity-80 transition-opacity hover:opacity-100'
          >
            <Image
              src='/linkedin.svg'
              alt='LinkedIn'
              width={22}
              height={22}
              className='dark:invert'
            />
          </a>
          <a
            href='https://github.com/bjornhansen'
            target='_blank'
            aria-label='GitHub'
            className='opacity-80 transition-opacity hover:opacity-100'
          >
            <Image
              src='/github.svg'
              alt='GitHub'
              width={22}
              height={22}
              className='dark:invert'
            />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
