import Image from 'next/image'

export default function Hero() {
  return (
    <div
      className={`max-w-screen-md mx-auto flex items-center space-y-12 flex-col my-12 mb-36
            md:flex-row md:space-x-12 md:space-y-0 md:my-48`}
    >
      <Image
        src={`/hey.png`}
        alt={`Image of Bjorn Hansen saying "Hey"`}
        width={300}
        height={300}
      ></Image>
      <div className={`flex flex-col`}>
        <h1 className={`font-inter text-6xl font-extrabold mb-8`}>
          I&apos;m Bjorn
        </h1>
        <p
          className={`font-inter text-4xl font-extrabold mb-6 text-orange-500`}
        >
          Entrepreneur
        </p>
        <p
          className={`font-inter text-4xl font-extrabold mb-6 text-emerald-600`}
        >
          Software engineer
        </p>
        <p className={`font-inter text-4xl font-extrabold text-blue-600`}>
          Chill guy
        </p>
      </div>
    </div>
  )
}
