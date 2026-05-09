# @palmprint/server

Node/Next.js server SDK for Palmprint signed challenge and session tokens.

```ts
import { createPalmprintServer } from "@palmprint/server";

const palmprint = createPalmprintServer({
  secret: process.env.PALMPRINT_SECRET!,
});

const challenge = palmprint.issueChallenge();
const session = await palmprint.issueSession({ challengeToken, clientToken });
```

Next.js helpers are available from:

```ts
import { createPalmprintNext } from "@palmprint/server/next";
import { createPalmprintRoutes } from "@palmprint/server/routes";
```
