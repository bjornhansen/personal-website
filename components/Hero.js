import Image from 'next/image'

export default function Hero() {
  return (
    <section className='mx-auto max-w-[760px] px-8 pt-[72px] pb-16'>
      <p className='mb-6 font-mono text-sm tracking-[0.18em] text-brand uppercase'>
        Head of Software · City Detect
      </p>
      <h1 className='font-serif text-5xl leading-[0.98] font-normal tracking-[-0.025em] md:text-[76px]'>
        Engineering
        <br />
        <span className='font-light'>leader</span>, builder &amp;
        entrepreneur.
      </h1>

      <div className='mt-11 flex flex-col-reverse gap-11 border-t border-line pt-9 md:flex-row md:items-start'>
        <p className='flex-1 font-serif text-[22px] leading-[1.55] text-ink-80'>
          I&apos;m an engineering leader, builder, and entrepreneur. As Head of
          Software at City Detect, I lead the team building an AI-powered
          platform that turns street-level imagery data into insight cities and
          other partners can act on. Earlier I co-founded Blackbird, a
          coding-education startup that taught more than 15,000 middle and high
          school students. I care most about building things that do real work
          in the world, and about building the amazing teams that make it
          happen.
        </p>
        <Image
          src='/hey.png'
          alt='Image of Bjorn Hansen saying "Hey"'
          width={140}
          height={140}
          priority
          className='h-[140px] w-[140px] shrink-0 object-contain'
        />
      </div>
    </section>
  )
}
