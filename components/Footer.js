import Image from "next/image";

const year = new Date().getFullYear();

export default function Footer() {
    return (
        <header>
            <ol>
                <li>Home</li>
                <li>Portfolio</li>
                <li>Writing</li>
                <li>Contact</li>
            </ol>
            <div>
                <Image src="/linkedin.svg" alt="Linkedin link and icon" width={15} height={15}></Image>
                <Image src="/github.svg" alt="Linkedin link and icon" width={15} height={15}></Image>
            </div>
            <p>Copyright {year} Bjorn Hansen</p>
        </header>
    )
}