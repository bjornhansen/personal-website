export const dynamic = 'force-dynamic'

export function GET(request) {
  const lat = parseFloat(request.headers.get('x-vercel-ip-latitude'))
  const lng = parseFloat(request.headers.get('x-vercel-ip-longitude'))
  const headers = { 'cache-control': 'private, no-store' }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json(null, { headers })
  }
  return Response.json({ lat, lng }, { headers })
}
