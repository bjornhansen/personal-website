import Image from "next/image";

export default function WritingItem({title, description, linkUrl, publicationName, publishDate, imageUrl, imageAlt}) {
    return (
        <div className={`max-w-screen-lg mx-auto flex md:space-x-12 my-12 md:my-32`}>
            <div className={`hidden md:block`}>
                <Image src={imageUrl} alt={imageAlt} width={200} height={200}></Image>
            </div>
            <div className={`flex flex-col`}>
                <h1 className={`font-inter text-2xl md:text-4xl font-extrabold mb-3`}>{title}</h1>
                <p className={`text-slate-400 mb-6`}>{publishDate}</p>
                <p className={`mb-6`}>{description}</p>
                {linkUrl &&
                    <a href={linkUrl} target="_blank" className={`underline text-xl hover:text-slate-600`}>Read in {publicationName} →</a>
                }
            </div>
        </div>
    );
}