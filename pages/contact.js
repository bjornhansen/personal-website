import Head from 'next/head'
import Header from 'components/Header'
import Footer from 'components/Footer'
import { Widget } from '@typeform/embed-react'

export default function Contact() {
    return (
        <>
            <Head>
                <title>Bjorn Hansen | Contact</title>
                <meta name="description" content="Contact Bjorn Hansen with this form."/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <link rel="icon" href="/favicon.ico"/>
            </Head>
            <Header page={`contact`}></Header>
            <Widget id="XDkBu8PP" style={{"width": "800px", "height": "600px"}} className="max-w-screen-lg mx-auto my-32" />
            <Footer page={`contact`}></Footer>
        </>
    )
}
