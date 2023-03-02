import Head from 'next/head'
import Header from 'components/Header'
import Footer from 'components/Footer'
import { PopupButton } from '@typeform/embed-react'

export default function Contact() {
    return (
        <>
            <Head>
                <title>Bjorn Hansen | Contact</title>
                <meta name="description" content="Get in touch with Bjorn Hansen by completing the form on this page. I'd love to hear from you!"/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <link rel="shortcut icon" href="/favicon.ico" />
            </Head>
            <Header page={`contact`}></Header>

            <div className={`text-center my-12 md:my-48`}>
                <PopupButton id="XDkBu8PP" className={`text-white bg-blue-500 p-4 rounded-2xl font-bold text-xl`}>
                    Contact Bjorn
                </PopupButton>
            </div>

            <Footer page={`contact`}></Footer>
        </>
    )
}
