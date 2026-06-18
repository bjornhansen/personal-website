export default function PortfolioItem({
  number,
  label,
  title,
  role,
  period,
  description,
  skills,
  linkUrl,
}) {
  return (
    <article>
      {/* Section label row */}
      <div className='flex items-baseline gap-4 border-t border-line pt-5 font-mono text-xs tracking-[0.16em] uppercase'>
        <span className='text-brand'>{number}</span>
        <span>{label}</span>
      </div>

      {/* Entry body */}
      <div className='pt-[30px] pb-11'>
        <div className='flex flex-col gap-x-4 sm:flex-row sm:items-baseline sm:justify-between'>
          <h2 className='font-serif text-[44px] font-normal tracking-[-0.02em] leading-tight'>
            {title}
          </h2>
          {period && (
            <span className='shrink-0 font-mono text-xs text-muted'>
              {period}
            </span>
          )}
        </div>

        {role && (
          <p className='mt-2 font-serif text-[19px] italic text-brand'>{role}</p>
        )}

        <p className='mt-5 max-w-[640px] text-[17px] leading-[1.65] text-ink-70'>
          {description}
        </p>

        {skills?.length > 0 && (
          <p className='mt-5 font-mono text-xs text-meta'>
            {skills.join(' · ')}
          </p>
        )}

        {linkUrl && (
          <a
            href={linkUrl}
            target='_blank'
            rel='noreferrer'
            className='mt-6 inline-block border-b border-ink pb-px text-sm text-ink transition-colors hover:text-brand hover:border-brand'
          >
            Visit {title} →
          </a>
        )}
      </div>
    </article>
  )
}
