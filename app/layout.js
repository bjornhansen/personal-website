import { Newsreader, JetBrains_Mono, Hanken_Grotesk } from 'next/font/google'
import Script from 'next/script'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import '@/styles/globals.css'

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
})
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-new',
  weight: ['400', '500', '700'],
  display: 'swap',
})
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans-new',
  weight: ['400', '500', '600'],
  display: 'swap',
})

// Production domain — used for canonical URL, Open Graph, and Twitter cards.
const SITE_URL = 'https://bjornhansen.dev'

const title = 'Bjorn Hansen | Head of Software at City Detect'
const description =
  'Bjorn Hansen is an engineering leader and entrepreneur. As Head of Software at City Detect, he builds products that helps make cities cleaner, safer, and more livable.'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  alternates: {
    canonical: '/',
  },
  icons: {
    shortcut: '/favicon.ico',
  },
  openGraph: {
    type: 'website',
    title,
    description,
    url: SITE_URL,
    images: ['/hey.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/hey.png'],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

// Runs before paint to set the theme from a saved preference, falling back to
// the device's `prefers-color-scheme`. Inlined to avoid a flash of wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`

export default function RootLayout({ children }) {
  return (
    <html
      lang='en'
      className={`scroll-smooth ${newsreader.variable} ${mono.variable} ${hanken.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className='font-sans bg-paper text-ink antialiased transition-colors'
      >
        {children}
        <Script
          src='https://www.googletagmanager.com/gtag/js?id=G-5XQNVP34CP'
          strategy='afterInteractive'
        />
        <Script id='google-analytics' strategy='afterInteractive'>
          {`window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());

                gtag('config', 'G-5XQNVP34CP');`}
        </Script>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
