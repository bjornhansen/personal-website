import Head from 'next/head'
import Header from 'components/Header'
import Footer from 'components/Footer'
import WritingItem from 'components/WritingItem'

export default function Writing() {
    return (
        <>
            <Head>
                <title>Bjorn Hansen | Writing</title>
                <meta name="description" content="Bjorn sometimes writes about stuff, usually thoughts on technology and the world. When he does, you can see it here."/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <link rel="shortcut icon" href="/favicon.ico" />
            </Head>
            <Header page={`writing`}></Header>

            <div className={`max-w-screen-lg mx-auto text-center p-3 mt-6 md:mt-24`}>
                <h1 className={`font-inter text-4xl md:text-6xl font-extrabold mb-8 mx-2`}>Writing</h1>
            </div>

            <div className={`mx-2`}>
                <WritingItem
                    title={`How to Choose the Best Programming Language to Learn First`}
                    description={`Which programming language should you learn first? The answer is: just pick one and start learning!`}
                    linkUrl={`https://hackernoon.com/how-to-choose-the-best-programming-language-to-learn-first-1s3j3uvs`}
                    publicationName={`HackerNoon`}
                    publishDate={`August 11th 2020`}
                    imageUrl={`/hn-logo.png`}
                    imageAlt={`Logo of the HackerNoon publication`}
                ></WritingItem>
            </div>

            <Footer page={`writing`}></Footer>
        </>
    )
}
