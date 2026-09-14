'use client'

import { create } from 'zustand'

export const SECTIONS = {
  building: {
    title: 'City Detect',
    number: '01',
    label: "What I'm building",
    role: 'Head of Software',
    period: '2023 — present',
    description:
      'City Detect uses AI to build cleaner, safer, and more livable cities — turning street-level imagery and data into insight that cities can act on. I lead the software team building and scaling the platform.',
    linkUrl: 'https://www.citydetect.com/',
    linkLabel: 'citydetect.com →',
  },
  background: {
    title: 'Blackbird',
    number: '02',
    label: 'Background',
    role: 'Co-founder',
    period: 'Previous startup',
    description:
      'Blackbird was a coding-education platform used in K-12 schools. We helped teach over 15,000 students to code in the classroom and demonstrated strong educational efficacy in pilots with prominent school districts in the United States and abroad, and released 4 popular Hour of Code activities on Code.org.',
    linkUrl: 'https://www.blackbirdcode.com/',
    linkLabel: 'blackbirdcode.com →',
  },
  contact: {
    title: "Let's talk.",
    number: '03',
    label: 'Get in touch',
    role: null,
    period: null,
    description:
      'Always happy to talk engineering, startups, or City Detect. I share most of what I\u2019m thinking about on LinkedIn.',
    linkUrl: 'mailto:blmhansen@gmail.com',
    linkLabel: 'blmhansen@gmail.com →',
  },
}

export const useSceneStore = create((set) => ({
  timeOfDay: null,
  isNight: false,
  activeSection: null,
  greeted: false,
  bearArrived: false,
  setTimeOfDay: (t) =>
    set({ timeOfDay: t, isNight: t !== null && (t < 6 || t >= 20) }),
  openSection: (id) => set({ activeSection: id, greeted: true }),
  closeSection: () => set({ activeSection: null }),
  setBearArrived: () => set({ bearArrived: true }),
}))
