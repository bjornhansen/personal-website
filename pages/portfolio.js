import Head from 'next/head'
import Header from 'components/Header'
import Footer from 'components/Footer'
import PortfolioItem from 'components/PortfolioItem'

export default function Portfolio() {
    return (
        <>
            <Head>
                <title>Bjorn Hansen | Portfolio</title>
                <meta name="description" content="Bjorn Hansen's portfolio."/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <link rel="icon" href="/favicon.ico"/>
            </Head>
            <Header page={`portfolio`}></Header>

            <div className={`max-w-screen-lg mx-auto text-center p-3 mt-24`}>
                <h1 className={`font-inter text-6xl font-extrabold mb-8`}>Portfolio</h1>
            </div>

            <PortfolioItem
                title={`This website!`}
                description={`I designed and built this portfolio website using modern web development tools.`}
                skills={['React', 'Next.js', 'Vercel', 'Tailwind CSS', 'JavaScript', 'Typeform']}
                linkUrl={null}
                imageUrl={`/arrows.png`}
                imageAlt={`An image of arrows pointing outward to the general website`}
            ></PortfolioItem>

            <PortfolioItem
                title={`Blackbird`}
                description={`My previous startup. Has taught over 15,000 kids to code in the classroom.`}
                skills={['JavaScript', 'PHP', 'PostgreSQL']}
                linkUrl={`https://www.blackbirdcode.com/`}
                imageUrl={`/blackbird.png`}
                imageAlt={`An image of the blackbird application running on a laptop computer`}
            ></PortfolioItem>

            <PortfolioItem
                title={`Goodist`}
                description={`An idea for an app I had and built an MVP for.`}
                skills={['Firebase', 'Firestore', 'JavaScript', 'jQuery', 'Bootstrap']}
                linkUrl={`https://goodist.webflow.io/`}
                imageUrl={`/goodist.png`}
                imageAlt={`An image of the goodist application running on an iPhone`}
            ></PortfolioItem>

            <Footer page={`portfolio`}></Footer>
        </>
    )
}
