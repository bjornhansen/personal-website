import Image from "next/image";
import Link from "next/link";

const year = new Date().getFullYear();

export default function Footer({page}) {
    return (
        <footer className={`max-w-screen-sm mx-auto`}>
            <div className={`text-center bg-white border drop-shadow-lg rounded-3xl p-6 mb-10 mx-2`}>
                <div className={`flex space-x-3 justify-center mb-6`}>
                    <span className={page === 'home' ? 'underline' : ''}>
                        <Link href={`/`}>Home</Link>
                    </span>
                    <span className={page === 'portfolio' ? 'underline' : ''}>
                        <Link href={`/portfolio`}>Portfolio</Link>
                    </span>
                    <span className={page === 'writing' ? 'underline' : ''}>
                        <Link href={`/writing`}>Writing</Link>
                    </span>
                    <span className={page === 'contact' ? 'underline' : ''}>
                        <Link href={`/contact`}>Contact</Link>
                    </span>
                </div>
                <div className={`flex space-x-3 justify-center mb-6`}>
                    <a href={`https://www.linkedin.com/in/bjornmhansen/`} target={`_blank`}>
                        <Image src="/linkedin.svg" alt="Linkedin link and icon" width={25} height={25}></Image>
                    </a>
                    <a href={`https://github.com/bjornhansen`} target={`_blank`}>
                        <Image src="/github.svg" alt="Linkedin link and icon" width={25} height={25}></Image>
                    </a>
                </div>
                <p>Copyright {year} Bjorn Hansen</p>
            </div>
        </footer>
    )
}