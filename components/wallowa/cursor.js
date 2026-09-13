const svg = (inner, size = 26) =>
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 24 24'><g stroke='#1a150f' stroke-width='0.6' stroke-linejoin='round'>${inner}</g></svg>`
  )

const paw = (fill) =>
  svg(
    `<g fill='${fill}'>
      <ellipse cx='12' cy='15.5' rx='5.2' ry='4.4'/>
      <ellipse cx='5.6' cy='10.4' rx='2' ry='2.6'/>
      <ellipse cx='9.4' cy='6.8' rx='2' ry='2.8'/>
      <ellipse cx='14.6' cy='6.8' rx='2' ry='2.8'/>
      <ellipse cx='18.4' cy='10.4' rx='2' ry='2.6'/>
    </g>`
  )

export const CURSOR_DEFAULT = `url("data:image/svg+xml,${paw('#FBFAF6')}") 13 13, auto`
export const CURSOR_POINTER = `url("data:image/svg+xml,${paw('#3ED074')}") 13 13, pointer`
