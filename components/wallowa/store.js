'use client'

import { create } from 'zustand'

export const SECTIONS = {
  building: { number: '01', label: "What I'm building" },
  background: { number: '02', label: 'Background' },
  contact: { number: '03', label: 'Get in touch' },
}

export const useSceneStore = create((set) => ({
  timeOfDay: null,
  sunAltitude: null,
  isNight: false,
  observer: null,
  activeSection: null,
  bearArrived: false,
  splash: null,
  setSky: ({ hour, sunAltitude }) =>
    set({ timeOfDay: hour, sunAltitude, isNight: sunAltitude < -6 }),
  setObserver: (observer) => set({ observer }),
  setBearArrived: () => set({ bearArrived: true }),
  emitSplash: (strength) => set({ splash: { strength, id: Math.random() } }),
  openSection: (id) => set({ activeSection: id }),
  closeSection: () => set({ activeSection: null }),
}))
