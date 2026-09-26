import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

function buildIdentity() {
  try {
    const git = (...args) => execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024 })
    const hash = createHash('sha256').update(git('diff', 'HEAD', '--binary'))
    const untracked = git('ls-files', '--others', '--exclude-standard', '-z').toString().split('\0').filter(Boolean).sort()
    for (const file of untracked) hash.update(file).update(readFileSync(file))
    return JSON.stringify({ commit: git('rev-parse', 'HEAD').toString().trim(), diffSha256: hash.digest('hex') })
  } catch {
    return JSON.stringify({ commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown', diffSha256: null })
  }
}

const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_WALLOWA_BUILD: buildIdentity() },
}

export default nextConfig
