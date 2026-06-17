import Image from 'next/image'
import Link from 'next/link'

const year = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className='mx-auto max-w-(--breakpoint-sm) px-4'>
      <div className='mb-10 rounded-3xl border border-slate-200 bg-white p-6 text-center drop-shadow-lg transition-colors dark:border-slate-800 dark:bg-slate-900'>
        <div className='mb-6 flex justify-center gap-5 text-sm font-medium'>
          <Link href='/' className='hover:text-brand dark:hover:text-brand-dark'>
            Home
          </Link>
          <Link href='#work' className='hover:text-brand dark:hover:text-brand-dark'>
            Work
          </Link>
          <a
            href='mailto:blmhansen@gmail.com'
            className='hover:text-brand dark:hover:text-brand-dark'
          >
            Contact
          </a>
        </div>

        <div className='mb-6 flex justify-center gap-3'>
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
        </div>
        <p className='text-sm text-slate-500 dark:text-slate-400'>
          Copyright {year} Bjorn Hansen
        </p>
      </div>
    </footer>
  )
}
