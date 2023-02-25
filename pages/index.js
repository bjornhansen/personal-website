import Head from 'next/head'
import Header from 'components/Header'
import Footer from 'components/Footer'
import Hero from 'components/Hero'

export default function Home() {
    return (
        <>
            <Head>
                <title>Bjorn Hansen</title>
                <meta name="description" content="Bjorn Hansen's personal website."/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <link rel="icon" href="/favicon.ico"/>
            </Head>
            <Header page={`home`}></Header>
            <Hero></Hero>
            <Footer page={`home`}></Footer>
        </>
    )
}
