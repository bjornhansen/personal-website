import Image from "next/image";

export default function PortfolioItem({title, description, skills, linkUrl, imageUrl, imageAlt}) {
    let skillsIterator = 0;
    return (
        <div className={`max-w-screen-lg mx-auto flex flex-col space-y-12 py-12 md:py-24 first:pt-12 last:mb-12 border-t first:border-t-0`}>
            <div className={`flex justify-center`}>
                <Image src={imageUrl} alt={imageAlt} width={600} height={400}></Image>
            </div>
            <div className={`flex flex-col`}>
                <h1 className={`font-inter text-3xl md:text-4xl font-extrabold mb-4`}>{title}</h1>
                <p className={`mb-6`}>{description}</p>
                <h3 className={`font-inter text-xl font-bold mb-6`}>Skills & technologies</h3>
                <div className={`flex flex-wrap mb-10`}>{skills.map((el) => {
                    return <div key={skillsIterator++} className={`border rounded-xl m-1 p-2`}>{el}</div>;
                })}</div>
                {linkUrl &&
                    <a href={linkUrl} target="_blank" className={`underline text-xl hover:text-slate-600`}>Check it out →</a>
                }
            </div>
        </div>
    );
}