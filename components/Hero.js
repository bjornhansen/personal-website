import Image from 'next/image'

export default function Hero() {
  return (
    <section className='mx-auto flex max-w-(--breakpoint-md) flex-col items-center gap-10 px-4 py-16 text-center md:flex-row md:gap-14 md:py-24 md:text-left'>
      <Image
        src='/hey.png'
        alt='Image of Bjorn Hansen saying "Hey"'
        width={220}
        height={220}
        priority
        className='shrink-0'
      />
      <div className='flex flex-col items-center md:items-start'>
        <h1 className='font-inter text-4xl font-semibold tracking-tight md:text-5xl'>
          Head of Software
        </h1>
        <a
          href='https://www.citydetect.com/'
          target='_blank'
          className='mt-3 flex items-center gap-2.5 transition-opacity hover:opacity-80'
        >
          <Image
            src='/citydetect-logo.png'
            alt='City Detect logo'
            width={40}
            height={40}
            className='shrink-0'
          />
          <span className='font-inter text-2xl tracking-tight text-brand md:text-3xl dark:text-brand-dark'>
            City Detect
          </span>
        </a>
        <p className='mt-6 max-w-md text-lg leading-relaxed text-slate-600 dark:text-slate-400'>
          Using AI to build cleaner, safer, and more livable cities.
        </p>
      </div>
    </section>
  )
}
