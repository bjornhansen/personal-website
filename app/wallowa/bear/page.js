'use client'

import dynamic from 'next/dynamic'

const BearStudy = dynamic(() => import('@/components/wallowa/BearStudy'), {
  ssr: false,
  loading: () => (
    <div className='fixed inset-0 flex items-center justify-center bg-[#dcd8cf] text-stone-600'>
      <p className='font-mono text-sm tracking-wide'>setting up the studio…</p>
    </div>
  ),
})

export default function BearStudyPage() {
  return <BearStudy />
}
