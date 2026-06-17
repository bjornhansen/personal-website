import { Inter, Open_Sans } from 'next/font/google'
import Script from 'next/script'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const openSans = Open_Sans({ subsets: ['latin'], variable: '--font-open-sans' })

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
    <html lang='en' suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${openSans.variable} font-sans ${inter.variable} bg-white text-slate-900 antialiased transition-colors dark:bg-slate-950 dark:text-slate-100`}
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
      </body>
    </html>
  )
}
