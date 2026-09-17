'use client'

import { create } from 'zustand'

export const useSceneStore = create((set) => ({
  timeOfDay: null,
  isNight: false,
  bearArrived: false,
  setTimeOfDay: (t) =>
    set({ timeOfDay: t, isNight: t !== null && (t < 6 || t >= 20) }),
  setBearArrived: () => set({ bearArrived: true }),
}))
