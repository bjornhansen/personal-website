'use client'

import { create } from 'zustand'

export const SECTIONS = {
  building: { number: '01', label: "What I'm building" },
  background: { number: '02', label: 'Background' },
  contact: { number: '03', label: 'Get in touch' },
}

export const useSceneStore = create((set) => ({
  timeOfDay: null,
  isNight: false,
  activeSection: null,
  bearArrived: false,
  setTimeOfDay: (t) =>
    set({ timeOfDay: t, isNight: t !== null && (t < 6 || t >= 20) }),
  setBearArrived: () => set({ bearArrived: true }),
  openSection: (id) => set({ activeSection: id }),
  closeSection: () => set({ activeSection: null }),
}))
