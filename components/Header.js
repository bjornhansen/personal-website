import Image from "next/image";
import Link from "next/link";

export default function Header({page}) {
    return (
        <header className="flex flex-row justify-between items-center p-4">
            <Link href={`/`} className={`text-3xl font-extrabold`}>Bjorn Hansen</Link>
            <div className={`flex space-x-3`}>
                <a href={`https://www.linkedin.com/in/bjornmhansen/`} target={`_blank`}>
                    <Image src="/linkedin.svg" alt="Linkedin link and icon" width={25} height={25}></Image>
                </a>
                <a href={`https://github.com/bjornhansen`} target={`_blank`}>
                    <Image src="/github.svg" alt="Linkedin link and icon" width={25} height={25}></Image>
                </a>
            </div>
            <div className={`flex space-x-3`}>
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
        </header>
    )
}