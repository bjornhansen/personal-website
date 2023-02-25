import Image from "next/image";

export default function PortfolioItem({title, description, skills, linkUrl, imageUrl, imageAlt}) {
    return (
        <div className={`max-w-screen-lg mx-auto flex space-x-12 my-32`}>
            <Image src={imageUrl} alt={imageAlt} width={300} height={300}></Image>
            <div className={`flex flex-col`}>
                <h1 className={`font-inter text-4xl font-extrabold mb-8`}>{title}</h1>
                <p>{description}</p>
                <p>{skills.join(', ')}</p>
                {linkUrl &&
                    <a href={linkUrl} target="_blank" className={`underline`}>Check it out →</a>
                }
            </div>
        </div>
    );
}