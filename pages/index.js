import Head from 'next/head'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Hero from '@/components/Hero'
import PortfolioItem from '@/components/PortfolioItem'

export default function Home() {
  return (
    <>
      <Head>
        <title>Bjorn Hansen | Entrepreneur and Full Stack Engineer</title>
        <meta
          name='description'
          content='Bjorn Hansen is an entrepreneur & full stack engineer with experience working in startups. Check out my resume and portfolio or hit me up! Currently in Oregon.'
        />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <link rel='shortcut icon' href='/favicon.ico' />
      </Head>
      <Header page={`home`}></Header>

      <Hero></Hero>

      <div
        id='portfolio'
        className={`max-w-screen-lg mx-auto text-center p-3 mt-6 md:mt-24`}
      >
        <h1
          className={`font-inter text-4xl md:text-6xl font-extrabold mb-8 mx-2`}
        >
          Portfolio
        </h1>
      </div>
      <div className={`mx-2`}>
        <PortfolioItem
          title={`This website!`}
          description={`I designed and built this portfolio website using modern web development tools, including:`}
          skills={['React', 'Next.js', 'Vercel', 'Tailwind CSS', 'JavaScript']}
          linkUrl={null}
          imageUrl={`/arrows.png`}
          imageAlt={`An image of arrows pointing outward to the general website`}
        ></PortfolioItem>

        <PortfolioItem
          title={`Blackbird`}
          description={`My previous startup. Blackbird is a cutting-edge coding education platform used in K-12 schools. We helped teach over 15,000 students to code in the classroom and demonstrated high educational efficacy with large pilots in prominent school districts in the United States and abroad. We also released 4 popular Hour of Code activities on Code.org.`}
          skills={[
            'JavaScript',
            'jQuery',
            'PHP',
            'PostgreSQL',
            'Sass',
            'Bootstrap',
            'AWS',
          ]}
          linkUrl={`https://www.blackbirdcode.com/`}
          imageUrl={`/blackbird.png`}
          imageAlt={`An image of the blackbird application running on a laptop computer`}
        ></PortfolioItem>

        <PortfolioItem
          title={`Goodist`}
          description={`I built this MVP for a customized charity subscription app. Giving effectively to charity can be hard in this noisy world -- how do you know which organizations will have the most impact? A friend and I were trying to come up with an easier way to give while also knowing your money was going to the best charities working in the areas you care about. We decided not to pursue this concept, but it lives on as a portfolio project!`}
          skills={[
            'Firebase',
            'Firestore',
            'JavaScript',
            'jQuery',
            'Bootstrap',
            'Webflow',
          ]}
          linkUrl={`https://goodist.webflow.io/`}
          imageUrl={`/goodist.png`}
          imageAlt={`An image of the goodist application running on an iPhone`}
        ></PortfolioItem>
      </div>

      <Footer page={`home`}></Footer>
    </>
  )
}
