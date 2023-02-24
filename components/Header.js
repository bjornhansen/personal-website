import Image from "next/image";
import Link from "next/link";

export default function Header() {
    return (
        <header className="flex flex-row justify-between items-center p-4">
            <h1 className={`text-3xl font-extrabold`}>Bjorn Hansen</h1>
            <div className={`flex space-x-3`}>
                <Image src="/linkedin.svg" alt="Linkedin link and icon" width={25} height={25}></Image>
                <Image src="/github.svg" alt="Linkedin link and icon" width={25} height={25}></Image>
            </div>
            <div className={`flex space-x-3`}>
                <Link href={`/`}>Home</Link>
                <Link href={`/portfolio`}>Portfolio</Link>
                <Link href={`/writing`}>Writing</Link>
                <Link href={`/contact`}>Contact</Link>
            </div>
        </header>
    )
}