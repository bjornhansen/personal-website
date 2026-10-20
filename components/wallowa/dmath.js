const PI = Math.PI
const TWO_PI = PI * 2
const HALF_PI = PI / 2

export function dsin(x) {
  x -= Math.floor((x + PI) / TWO_PI) * TWO_PI
  if (x > HALF_PI) x = PI - x
  else if (x < -HALF_PI) x = -PI - x
  const x2 = x * x
  return (
    x *
    (1 +
      x2 *
        (-1 / 6 +
          x2 *
            (1 / 120 +
              x2 *
                (-1 / 5040 +
                  x2 * (1 / 362880 + x2 * (-1 / 39916800 + x2 * (1 / 6227020800 + x2 * (-1 / 1307674368000))))))))
  )
}

export function dcos(x) {
  return dsin(x + HALF_PI)
}

function atanUnit(t) {
  const t2 = t * t
  return (
    t *
    (0.99997726 +
      t2 * (-0.33262347 + t2 * (0.19354346 + t2 * (-0.11643287 + t2 * (0.05265332 + t2 * -0.0117212)))))
  )
}

export function datan2(y, x) {
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  if (ax === 0 && ay === 0) return 0
  const swap = ay > ax
  const t = swap ? ax / ay : ay / ax
  let a = atanUnit(t)
  if (swap) a = HALF_PI - a
  if (x < 0) a = PI - a
  return y < 0 ? -a : a
}

export function pow6(x) {
  const x2 = x * x
  return x2 * x2 * x2
}
