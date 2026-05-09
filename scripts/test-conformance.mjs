import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  createPalmprintServer,
  PalmprintTokenError,
  parseClientToken,
} from "../packages/server/dist/index.js";

const fixture = JSON.parse(
  readFileSync(new URL("../conformance/fixtures.json", import.meta.url), "utf8"),
);

function expectCode(fn, code) {
  try {
    fn();
  } catch (error) {
    assert(error instanceof PalmprintTokenError);
    assert.equal(error.code, code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

async function expectCodeAsync(fn, code) {
  try {
    await fn();
  } catch (error) {
    assert(error instanceof PalmprintTokenError);
    assert.equal(error.code, code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

const sdk = createPalmprintServer({
  secret: fixture.secret,
  issuer: "conformance",
  audience: "demo",
});

assert.deepEqual(sdk.verifyChallenge(fixture.challenge.token), fixture.challenge.payload);
assert.deepEqual(sdk.verifySession(fixture.session.token), fixture.session.payload);
assert.deepEqual(parseClientToken(fixture.client.token), fixture.client.payload);

expectCode(
  () => sdk.verifySession(fixture.challenge.token),
  fixture.expectedErrors.wrongKind,
);
expectCode(
  () => sdk.verifyChallenge(fixture.badSignatureChallenge),
  fixture.expectedErrors.badSignature,
);
expectCode(
  () => sdk.verifyChallenge(fixture.expiredChallenge.token),
  fixture.expectedErrors.expired,
);
expectCode(
  () => sdk.verifySession(fixture.expiredSession.token),
  fixture.expectedErrors.expired,
);
expectCode(
  () => sdk.verifyChallenge(fixture.malformedToken),
  fixture.expectedErrors.malformedToken,
);
expectCode(
  () => parseClientToken("palmprint.not-json"),
  fixture.expectedErrors.clientTokenInvalid,
);
expectCode(
  () => parseClientToken(fixture.expiredClient.token),
  fixture.expectedErrors.expired,
);

const redeemSdk = createPalmprintServer({
  secret: fixture.secret,
  issuer: "conformance",
  audience: "demo",
});
const issued = await redeemSdk.issueSession({
  challengeToken: fixture.challenge.token,
  clientToken: fixture.client.token,
});
const issuedPayload = redeemSdk.verifySession(issued.token);
assert.equal(issuedPayload.challenge_nonce, fixture.challenge.payload.nonce);
assert.equal(issuedPayload.level, fixture.client.payload.level);
assert.equal(issuedPayload.steps, fixture.client.payload.steps);

await expectCodeAsync(
  () =>
    redeemSdk.issueSession({
      challengeToken: fixture.challenge.token,
      clientToken: fixture.client.token,
    }),
  fixture.expectedErrors.nonceAlreadyConsumed,
);

await expectCodeAsync(
  () =>
    sdk.issueSession({
      challengeToken: fixture.highChallenge.token,
      clientToken: fixture.lowClient.token,
    }),
  fixture.expectedErrors.insufficientLevel,
);

await expectCodeAsync(
  () =>
    sdk.issueSession({
      challengeToken: fixture.challenge.token,
      clientToken: fixture.mismatchClient.token,
    }),
  fixture.expectedErrors.challengeNonceMismatch,
);

console.log("Node conformance fixtures passed");
