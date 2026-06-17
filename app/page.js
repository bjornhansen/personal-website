import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Hero from '@/components/Hero'
import PortfolioItem from '@/components/PortfolioItem'

// Production domain — used for the JSON-LD structured data below.
const SITE_URL = 'https://bjornhansen.dev'

const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Bjorn Hansen',
  jobTitle: 'Head of Software',
  worksFor: {
    '@type': 'Organization',
    name: 'City Detect',
  },
  url: SITE_URL,
  sameAs: [
    'https://www.linkedin.com/in/bjornmhansen/',
    'https://github.com/bjornhansen',
  ],
}

export default function Home() {
  return (
    <>
      {/* Structured data */}
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />

      <Header />

      <Hero />

      {/* Positioning */}
      <section id='about' className='mx-auto max-w-(--breakpoint-md) px-4'>
        <p className='text-xl leading-relaxed text-slate-700 md:text-2xl dark:text-slate-300'>
          I&apos;m an engineering leader, builder, and entrepreneur. As Head of
          Software at City Detect, I lead the team building an AI-powered
          platform that turns street-level imagery data into insight cities and
          other partners can act on. Earlier I co-founded Blackbird, a
          coding-education startup that taught more than 15,000 middle and high
          school students. I care most about building things that do real work
          in the world, and about building the amazing teams that make it
          happen.
        </p>
      </section>

      {/* What I'm building now */}
      <section id='work' className='mx-auto max-w-(--breakpoint-md) px-4 pt-20'>
        <h2 className='mb-6 font-inter text-3xl font-extrabold tracking-tight md:text-4xl'>
          What I&apos;m building
        </h2>
        <PortfolioItem
          title='City Detect'
          role='Head of Software'
          period='2023 — present'
          description='City Detect uses AI to build cleaner, safer, and more livable cities — turning street-level imagery and data into insight that cities can act on. I lead the software team building and scaling the platform.'
          skills={[
            'AI / ML',
            'Computer Vision',
            'Python',
            'Cloud',
            'Data Platforms',
          ]}
          linkUrl='https://www.citydetect.com/'
        />
      </section>

      {/* Background */}
      <section
        id='background'
        className='mx-auto max-w-(--breakpoint-md) px-4 pt-20'
      >
        <h2 className='mb-6 font-inter text-3xl font-extrabold tracking-tight md:text-4xl'>
          Background
        </h2>
        <PortfolioItem
          title='Blackbird'
          role='Co-founder'
          period='Previous startup'
          description='Blackbird was a coding-education platform used in K-12 schools. We helped teach over 15,000 students to code in the classroom and demonstrated strong educational efficacy in pilots with prominent school districts in the United States and abroad, and released 4 popular Hour of Code activities on Code.org.'
          skills={[
            'JavaScript',
            'jQuery',
            'PHP',
            'PostgreSQL',
            'Sass',
            'Bootstrap',
            'AWS',
          ]}
          linkUrl='https://www.blackbirdcode.com/'
        />
      </section>

      {/* Contact CTA */}
      <section
        id='contact'
        className='mx-auto max-w-(--breakpoint-md) px-4 pt-20 pb-24 text-center'
      >
        <h2 className='mb-6 font-inter text-3xl font-extrabold tracking-tight md:text-4xl'>
          Get in touch
        </h2>
        <p className='mb-8 text-xl text-slate-700 dark:text-slate-300'>
          Always happy to talk engineering, startups, or City Detect. I share
          most of what I&apos;m thinking about on LinkedIn.
        </p>
        <div className='flex flex-col justify-center gap-4 md:flex-row'>
          <a
            href='mailto:blmhansen@gmail.com'
            className='text-xl underline underline-offset-4 hover:text-brand dark:hover:text-brand-dark'
          >
            Email me →
          </a>
          <a
            href='https://www.linkedin.com/in/bjornmhansen/'
            target='_blank'
            className='text-xl underline underline-offset-4 hover:text-brand dark:hover:text-brand-dark'
          >
            Connect on LinkedIn →
          </a>
        </div>
      </section>

      <Footer />
    </>
  )
}
