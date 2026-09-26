# Font loading and Turbopack

Development (`next dev`) and production (`next build`) use Turbopack.

`app/layout.js` loads the existing font families through `next/font/local`
from exact-version Fontsource npm dependencies:

| Family | Package | Included faces |
| --- | --- | --- |
| Newsreader | `@fontsource-variable/newsreader` | Latin, normal and italic, weights 300–600 |
| JetBrains Mono | `@fontsource-variable/jetbrains-mono` | Latin, normal, weights 400–700 |
| Hanken Grotesk | `@fontsource-variable/hanken-grotesk` | Latin, normal, weights 400–600 |

Next.js bundles and preloads the local WOFF2 files, applies fallback-font metric
adjustment, and preserves the existing CSS variables and `display: swap`.
Font files are supplied by the npm packages under OFL-1.1; their licenses are
included in the packages. Installation uses the lockfile, and the application
build does not request stylesheets or font files from Google. Add appropriate
font subsets if the site gains content outside the current Latin coverage.

## Why the Google loader was replaced

Deployment `5ae402d` failed in Next.js 16.2.9 with:

```text
Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'
next/font/google queries have exactly one entry
```

The failure signature matches [Next.js issue #99114](https://github.com/vercel/next.js/issues/99114).
Google Fonts can return extensionless URLs such as
`https://fonts.gstatic.com/l/font?kit=...&skey=...&v=...` instead of a URL ending
in `.woff2`. In Next 16.2.9, Turbopack serializes the URL into JSON and parses
that JSON as a query string; embedded ampersands split it into multiple entries.
Its font-file resolver also expects an extension. The upstream issue reports
the problem on 16.3.6 and newer canary builds, so an upgrade alone was not a
verified fix when this change was made.

The temporary Webpack workaround successfully deployed `6f03638`, but the
upstream report also documents a separate Webpack failure for the same Google
response shape. Bundling the font files removes this response-dependent build
path while keeping Turbopack and Next's font optimization.

After changing font loading, run lint and a clean production build, check that
the emitted font files load in a browser, and verify a Vercel deployment. An
empty `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` fixture can guard against accidentally
reintroducing a Google loader during the clean build.
