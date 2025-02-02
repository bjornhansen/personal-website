import Image from 'next/image'
import Link from 'next/link'

const year = new Date().getFullYear()

export default function Footer({ page }) {
  return (
    <footer className={`max-w-screen-sm mx-auto`}>
      <div
        className={`text-center bg-white border drop-shadow-lg rounded-3xl p-6 mb-10 mx-2`}
      >
        <div className={`flex space-x-3 justify-center mb-6`}>
          <Link href={`/`} className='hover:text-slate-600'>
            Home
          </Link>
          <a
            className={`hover:text-slate-600`}
            target='_blank'
            href={`https://docs.google.com/document/d/e/2PACX-1vRJPiahOB91d8DlV2EwyvnfqhKxWMJ7_GhihleHcGac9GyGgIMlVVhvtuXpvm2x7-oYFKXWCGp-ViDo/pub`}
          >
            Résumé
          </a>
          <Link className={`hover:text-slate-600`} href={`#portfolio`}>
            Portfolio
          </Link>
          <a
            className={`hover:text-slate-600`}
            href='mailto:blmhansen@gmail.com'
          >
            Contact
          </a>
        </div>

        <div className={`flex space-x-3 justify-center mb-6`}>
          <a
            href={`https://www.linkedin.com/in/bjornmhansen/`}
            target={`_blank`}
          >
            <Image
              src='/linkedin.svg'
              alt='Linkedin link and icon'
              width={25}
              height={25}
            ></Image>
          </a>
          <a href={`https://github.com/bjornhansen`} target={`_blank`}>
            <Image
              src='/github.svg'
              alt='Linkedin link and icon'
              width={25}
              height={25}
            ></Image>
          </a>
        </div>
        <p>Copyright {year} Bjorn Hansen</p>
      </div>
    </footer>
  )
}
