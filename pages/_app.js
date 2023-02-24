import {Inter, Open_Sans} from 'next/font/google'

const inter = Inter({subsets: ['latin'], variable: '--font-inter'})
const openSans = Open_Sans({subsets: ['latin'], variable: '--font-open-sans'})

import '@/styles/globals.css'

export default function App({Component, pageProps}) {
    return (
        <main className={`${openSans.variable} font-sans ${inter.variable}`}>
            <Component {...pageProps} />
        </main>
    )
}
