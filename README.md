<br />

<p>
  <a href="https://itty.dev/itty-router">
     <img src="https://github.com/kwhitley/itty-router/assets/865416/ed7de66a-b876-46a8-a65f-429dc6d3da20" alt="Itty Router" height="120" />
  </a>
<p>

[![Version](https://img.shields.io/npm/v/itty-router.svg?style=flat-square)](https://npmjs.com/package/itty-router)
[![Bundle Size](https://deno.bundlejs.com/?q=itty-router/Router&badge&badge-style=flat-square)](https://deno.bundlejs.com/?q=itty-router)
[![Build Status](https://img.shields.io/github/actions/workflow/status/kwhitley/itty-router/verify.yml?style=flat-square)](https://coveralls.io/github/kwhitley/itty-router)
[![Coverage](https://img.shields.io/coveralls/github/kwhitley/itty-router?style=flat-square)](https://coveralls.io/github/kwhitley/itty-router)
[![Downloads](https://img.shields.io/npm/dw/itty-router?style=flat-square)](https://npmjs.com/package/itty-router)
[![Issues](https://img.shields.io/github/issues/kwhitley/itty-router?style=flat-square)](https://coveralls.io/github/kwhitley/itty-router)
[![Discord](https://img.shields.io/discord/832353585802903572?label=Discord&logo=Discord&style=flat-square&logoColor=fff)](https://discord.gg/53vyrZAu9u)
[![Github](https://img.shields.io/github/stars/kwhitley/itty-router?style=social)](https://github.com/kwhitley/itty-router)
[![Follow @ittydev](https://img.shields.io/twitter/follow/ittydev.svg?style=social&label=Follow)](https://www.twitter.com/ittydev)

###  [v5 Documentation](https://itty.dev/itty-router) &nbsp;| &nbsp; [v4 -> v5 Migration Guide](https://itty.dev/itty-router/migrations/v4-v5) &nbsp;| &nbsp; [Discord](https://discord.gg/53vyrZAu9u)

---

An ultra-tiny API microrouter, for use when [size matters](https://github.com/TigersWay/cloudflare-playground) (e.g. [Cloudflare Workers](https://developers.cloudflare.com/workers/)).

## Features

- Tiny. Routers from [~450 bytes](https://itty.dev/itty-router/routers/ittyrouter) to a [~970 bytes](https://itty.dev/itty-router/routers/autorouter) batteries-included version (~240-500x smaller than Express.js).
- [TypeScript](https://itty.dev/itty-router/typescript). Powerfully (and flexibly) typed for any environment.
- [Route-parsing](https://itty.dev/itty-router/route-patterns) & [query parsing](https://itty.dev/itty-router/query-params).
- [Middleware](https://itty.dev/itty-router/middleware). Use ours or write your own.
- [100% Test Coverage](https://coveralls.io/github/kwhitley/itty-router?branch=v5.x). Bulletproof for production peace-of-mind.
- Designed specifically for serverless (but works anywhere).
- No assumptions. Return anything; pass in anything.
- Future-proof.  HTTP methods not-yet-invented already work with it.

## Example

```js
import { AutoRouter } from 'itty-router' // ~1kB

const router = AutoRouter()

router
  .get('/hello/:name', ({ name }) => `Hello, ${name}!`)
  .get('/json', () => [1,2,3])
  .get('/promises', () => Promise.resolve('foo'))

export default { ...router } // strips the proxy

// that's it ^-^
```

## Route introspection (opt-in)

For tooling, deploy diffing, or debugging, `explain` reports which route a
request **would** hit without executing any handler (no `before`, route,
`catch`, or `finally` stages run), and without mutating
`request.query`/`params`/`route`/`proxy`. It shares the exact same route
compilation and matching logic as `fetch`.

```js
import { Router, explain, fingerprint } from 'itty-router'

const router = Router()
  .get('/users/:id', () => {})
  .post('/users', () => {})
  .all('/admin/*', () => {})

const result = explain(router, new Request('https://x.com/users/13'))
// {
//   pathname: '/users/13',
//   method: 'GET',
//   routes: [
//     { index: 0, method: 'GET', route: '/users/:id', pattern: '...',
//       handlerCount: 1, methodMatched: true, patternMatched: true,
//       matched: true, skipped: null },
//     { index: 1, method: 'POST', route: '/users', ...,
//       methodMatched: false, patternMatched: undefined, skipped: 'method' },
//     { index: 2, method: 'ALL', route: '/admin/*', ...,
//       methodMatched: true, patternMatched: false, skipped: 'pattern' },
//   ],
//   route: '/users/:id',
//   params: { id: '13' },
// }
```

`fingerprint` returns a cross-process-stable hash of the observable route
table. It is derived solely from the method, cleaned route string, compiled
pattern, and handler count — never handler source code or object identity,
and never query strings (repeated query keys included). Adding/removing a
route or changing registration order changes the hash; identical
registrations (even in separate processes or ESM/CJS builds) share it.

```js
const a = fingerprint(routerA).hash
const b = fingerprint(routerB).hash
a === b // true when both instances loaded the same configuration
```

Both functions also accept a minimal `{ method, url }` RequestLike object,
and each returned explanation/fingerprint is a frozen snapshot unaffected by
routes registered afterwards.

<br />

## Need Help?
[Complete API documentation](https://itty.dev/itty-router) is available on [itty.dev](https://itty.dev/itty-router), or join our [Discord](https://discord.gg/53vyrZAu9u) channel to chat with community members for quick help!

## Join the Discussion!
Have a question? Suggestion? Idea? Complaint? Want to send a gift basket? Join us on [Discord](https://discord.gg/53vyrZAu9u)!

# A Special Thanks :heart:

As the community and contributor list has grown (and thus an individualized list here is no longer easily maintainable), I'd like to thank each and every one of you for making itty far greater than its humble origins.  The robustness you see today, the careful consideration of every byte spent on features, the API choices, the code-golfing itself... are all thanks to the efforts and feedback from the community.  I'd especially like to thank the core contributors and PR-authors, as well as the fantastic folks on the [itty Discord](https://discord.gg/53vyrZAu9u) group, for their tireless work refining this little beast and answering community questions.


