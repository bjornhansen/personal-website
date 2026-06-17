export default function PortfolioItem({
  title,
  role,
  period,
  description,
  skills,
  linkUrl,
}) {
  return (
    <article className='rounded-2xl border border-slate-200 bg-white p-6 transition-colors md:p-8 dark:border-slate-800 dark:bg-slate-900'>
      <div className='flex items-start gap-4'>
        <span
          aria-hidden='true'
          className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 font-inter text-lg font-extrabold text-white dark:bg-white dark:text-slate-900'
        >
          {title.charAt(0)}
        </span>
        <div className='flex-1'>
          <div className='flex flex-col gap-x-3 sm:flex-row sm:items-baseline sm:justify-between'>
            <h2 className='font-inter text-2xl font-extrabold tracking-tight'>
            {title}
          </h2>
            {period && (
              <span className='text-sm text-slate-500 dark:text-slate-400'>
                {period}
              </span>
            )}
          </div>
          {role && (
            <p className='font-inter font-semibold text-brand dark:text-brand-dark'>
              {role}
            </p>
          )}
        </div>
      </div>

      <p className='mt-5 leading-relaxed text-slate-700 dark:text-slate-300'>
        {description}
      </p>

      <div className='mt-6 flex flex-wrap gap-2'>
        {skills.map((skill, i) => (
          <span
            key={i}
            className='rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400'
          >
            {skill}
          </span>
        ))}
      </div>

      {linkUrl && (
        <a
          href={linkUrl}
          target='_blank'
          className='mt-6 inline-block font-medium text-brand underline-offset-4 hover:underline dark:text-brand-dark'
        >
          Visit {title} →
        </a>
      )}
    </article>
  )
}
