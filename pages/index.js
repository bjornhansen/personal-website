import Head from 'next/head'
import Header from 'components/Header'
import Footer from 'components/Footer'
import Hero from 'components/Hero'

export default function Home() {
    return (
        <>
            <Head>
                <title>Bjorn Hansen | Entrepreneur and Full Stack Engineer</title>
                <meta name="description" content="Bjorn Hansen is an entrepreneur & full stack engineer with experience working in startups. Check out my resume and portfolio or hit me up! Currently in Oregon."/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <link rel="shortcut icon" href="/favicon.ico" />
            </Head>
            <Header page={`home`}></Header>
            <Hero></Hero>

            <div className={`max-w-screen-lg mx-auto px-3 mb-24 text-center`}>
                <h1 className={`font-inter text-4xl font-extrabold mb-12`}>My résumé</h1>
                <div style={{position: 'relative', width: '100%', height: 0, paddingTop: '129.4118%',
                    paddingBottom: 0, boxShadow: '0 2px 8px 0 rgba(63,69,81,0.16)', marginTop: '1.6em', marginBottom: '0.9em', overflow: 'hidden',
                    borderRadius: 8, willChange: 'transform'}}>
                    <iframe loading="lazy" style={{position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, border: 'none', padding: 0, margin: 0}}
                            src="https://www.canva.com&#x2F;design&#x2F;DAFPz2-RNDQ&#x2F;view?embed" allow="fullscreen">
                    </iframe>
                </div>
            </div>

            <Footer page={`home`}></Footer>
        </>
    )
}
