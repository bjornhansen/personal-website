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

      <div className='mx-auto max-w-[760px] px-8'>
        {/* What I'm building now */}
        <section id='work'>
          <PortfolioItem
            number='01'
            label="What I'm building"
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
        <section id='background'>
          <PortfolioItem
            number='02'
            label='Background'
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
      </div>

      {/* Contact CTA — full-bleed dark band (dark in both modes) */}
      <section id='contact' className='bg-[#1A1A17] text-[#FBFAF6]'>
        <div className='mx-auto max-w-[760px] px-8 py-[72px]'>
          <p className='mb-6 font-mono text-xs tracking-[0.16em] text-[#3ED074] uppercase'>
            03 — Get in touch
          </p>
          <h2 className='font-serif text-[52px] font-normal tracking-[-0.02em] leading-tight'>
            Let&apos;s talk.
          </h2>
          <p className='mt-6 max-w-[560px] font-serif text-[21px] leading-[1.55] text-[#C9C8C0]'>
            Always happy to talk engineering, startups, or City Detect. I share
            most of what I&apos;m thinking about on LinkedIn.
          </p>
          <div className='mt-10 flex flex-col gap-9 sm:flex-row'>
            <a
              href='mailto:blmhansen@gmail.com'
              className='inline-block w-fit border-b border-[#3ED074] pb-px text-[#3ED074] transition-opacity hover:opacity-80'
            >
              blmhansen@gmail.com →
            </a>
            <a
              href='https://www.linkedin.com/in/bjornmhansen/'
              target='_blank'
              rel='noreferrer'
              className='inline-block w-fit border-b border-[#FBFAF6] pb-px text-[#FBFAF6] transition-opacity hover:opacity-80'
            >
              Connect on LinkedIn →
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
