import Image from "next/image";
import Link from "next/link";
import {PopupButton} from "@typeform/embed-react";


export default function Header({page}) {
    return (
        <header className="flex flex-col md:flex-row space-y-6 md:space-y-0 justify-between items-center p-4">
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
                <span className={`hover:text-slate-600`}>
                    <Link href={`/`}>Home</Link>
                </span>
                <span className={`hover:text-slate-600`}>
                    <a target="_blank" href={`https://docs.google.com/document/d/e/2PACX-1vRTOG0DPT0GjcqezQztmnvFAw6tiR3StPyr6u1gcVZWiT9d4fTkpn-No-1VRDtQkBjiQPIIKMMNqLKm/pub`}>Résumé</a>
                </span>
                <span className={`hover:text-slate-600`}>
                    <Link href={`#portfolio`}>Portfolio</Link>
                </span>
                <span className={`hover:text-slate-600`}>
                    <Link href={`#writing`}>Writing</Link>
                </span>
                <span className={`hover:text-slate-600`}>
                    <PopupButton id="XDkBu8PP">
                        Contact
                    </PopupButton>
                </span>
            </div>
        </header>
    )
}