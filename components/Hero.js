import Image from "next/image";

export default function Hero() {
    return (
        <div className={`max-w-screen-md mx-auto flex space-x-12 my-48`}>
            <Image src={`/hey.png`} alt={`Image of Bjorn Hansen saying "Hey~"`} width={300} height={300}></Image>
            <div className={`flex flex-col`}>
                <h1 className={`font-inter text-6xl font-extrabold mb-8`}>I&apos;m Bjorn</h1>
                <p className={`font-inter text-4xl font-extrabold mb-6 text-orange-500`}>Entrepreneur</p>
                <p className={`font-inter text-4xl font-extrabold mb-6 text-emerald-600`}>Full stack engineer</p>
                <p className={`font-inter text-4xl font-extrabold text-blue-600`}>Chill guy</p>
            </div>
        </div>
    );
}