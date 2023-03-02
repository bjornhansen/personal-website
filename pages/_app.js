import {Inter, Open_Sans} from 'next/font/google'
import Script from 'next/script';

const inter = Inter({subsets: ['latin'], variable: '--font-inter'})
const openSans = Open_Sans({subsets: ['latin'], variable: '--font-open-sans'})

import '@/styles/globals.css'

export default function App({Component, pageProps}) {
    return (
        <main className={`${openSans.variable} font-sans ${inter.variable}`}>
            <Script
                src="https://www.googletagmanager.com/gtag/js?id=G-5XQNVP34CP"
                strategy="afterInteractive"
            ></Script>
            <Script id="google-analytics" strategy="afterInteractive">
                {`window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());

                gtag('config', 'G-5XQNVP34CP');`}
            </Script>
            <Component {...pageProps} />
        </main>
    )
}
