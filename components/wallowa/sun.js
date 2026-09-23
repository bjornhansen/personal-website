const RAD = Math.PI / 180
const DAY_MS = 86400000
const J1970 = 2440588
const J2000 = 2451545
const OBLIQUITY = RAD * 23.4397

const toDays = (date) => date.valueOf() / DAY_MS - 0.5 + J1970 - J2000

const rightAscension = (l, b) =>
  Math.atan2(
    Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY),
    Math.cos(l)
  )

const declination = (l, b) =>
  Math.asin(
    Math.sin(b) * Math.cos(OBLIQUITY) +
      Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l)
  )

const siderealTime = (d, lw) => RAD * (280.16 + 360.9856235 * d) - lw

function sunCoords(d) {
  const M = RAD * (357.5291 + 0.98560028 * d)
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const L = M + C + RAD * 102.9372 + Math.PI
  return { dec: declination(L, 0), ra: rightAscension(L, 0) }
}

function moonCoords(d) {
  const L = RAD * (218.316 + 13.176396 * d)
  const M = RAD * (134.963 + 13.064993 * d)
  const F = RAD * (93.272 + 13.22935 * d)
  const l = L + RAD * 6.289 * Math.sin(M)
  const b = RAD * 5.128 * Math.sin(F)
  return { ra: rightAscension(l, b), dec: declination(l, b) }
}

function toDirection(H, phi, dec, out) {
  const alt = Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)
  )
  const az = Math.atan2(
    Math.sin(H),
    Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)
  )
  out.x = Math.cos(alt) * Math.sin(az)
  out.y = Math.sin(alt)
  out.z = -Math.cos(alt) * Math.cos(az)
  return alt / RAD
}

export function celestialState(date, lat, lng) {
  const d = toDays(date)
  const lw = RAD * -lng
  const phi = RAD * lat
  const lst = siderealTime(d, lw)

  const sun = sunCoords(d)
  const moon = moonCoords(d)
  const sunDir = { x: 0, y: 0, z: 0 }
  const moonDir = { x: 0, y: 0, z: 0 }
  const sunAltitude = toDirection(lst - sun.ra, phi, sun.dec, sunDir)
  const moonAltitude = toDirection(lst - moon.ra, phi, moon.dec, moonDir)

  const elongation = Math.acos(
    Math.sin(sun.dec) * Math.sin(moon.dec) +
      Math.cos(sun.dec) * Math.cos(moon.dec) * Math.cos(sun.ra - moon.ra)
  )
  const moonIllumination = (1 - Math.cos(elongation)) / 2

  return { sunDir, sunAltitude, moonDir, moonAltitude, moonIllumination, lst, phi }
}

export function celestialBasis(lst, phi) {
  const P = [0, Math.sin(phi), Math.cos(phi)]
  const E = [0, Math.cos(phi), -Math.sin(phi)]
  const W = [1, 0, 0]
  const c = Math.cos(lst)
  const s = Math.sin(lst)
  return [
    c * E[0] + s * W[0], c * E[1] + s * W[1], c * E[2] + s * W[2],
    s * E[0] - c * W[0], s * E[1] - c * W[1], s * E[2] - c * W[2],
    P[0], P[1], P[2],
  ]
}
