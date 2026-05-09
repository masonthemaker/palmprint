# @palmprint/react

React SDK for Palmprint browser verification.

```tsx
import { PalmprintProvider, usePalmprint } from "@palmprint/react";

function ActionButton() {
  const { verify } = usePalmprint();

  async function onClick() {
    const { sessionToken } = await verify({ level: "high" });
    await fetch("/api/protected", {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
  }

  return <button onClick={onClick}>Verify</button>;
}
```

Also exports `PalmprintGuard`, `VerifyWidget`, `CaptchaCheckbox`, and the core
camera challenge component.
