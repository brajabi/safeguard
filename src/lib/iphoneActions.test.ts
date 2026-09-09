import assert from "node:assert/strict";
import test from "node:test";
import {
  requestShadowrocketConnection,
  SHADOWROCKET_CONNECT_URL,
  timeZoneInstructions,
} from "./iphoneActions";

test("unsupported platforms never query or launch Shadowrocket", async () => {
  for (const platform of ["android", "web"]) {
    const result = await requestShadowrocketConnection(platform, {
      canOpenURL: async () => assert.fail("must not query"),
      openURL: async () => assert.fail("must not launch"),
    });
    assert.equal(result.opened, false);
  }
});

test("missing Shadowrocket does not launch another URL", async () => {
  const result = await requestShadowrocketConnection("ios", {
    canOpenURL: async (url) => {
      assert.equal(url, "shadowrocket://connect");
      return false;
    },
    openURL: async () => assert.fail("must not launch"),
  });
  assert.equal(result.opened, false);
  assert.match(result.message, /Install and configure/);
});

test("success requests connect only and never reports a verified connection", async () => {
  const calls: string[] = [];
  const result = await requestShadowrocketConnection("ios", {
    canOpenURL: async (url) => {
      calls.push(`query:${url}`);
      return true;
    },
    openURL: async (url) => {
      calls.push(`open:${url}`);
    },
  });
  assert.deepEqual(calls, [
    `query:${SHADOWROCKET_CONNECT_URL}`,
    `open:${SHADOWROCKET_CONNECT_URL}`,
  ]);
  assert.deepEqual(result, {
    opened: true,
    message: "Connection requested. Return to Safeguard to check it.",
  });
});

test("query and launch failures return an actionable result", async () => {
  for (const failingStep of ["query", "open"]) {
    const result = await requestShadowrocketConnection("ios", {
      canOpenURL: async () => {
        if (failingStep === "query") throw new Error("Unavailable");
        return true;
      },
      openURL: async () => {
        throw new Error("Unavailable");
      },
    });
    assert.equal(result.opened, false);
    assert.match(result.message, /Open it manually/);
  }
});

test("Ireland instructions provide Dublin and the manual iOS settings path", () => {
  const message = timeZoneInstructions("IE");
  assert.match(message, /Settings > General > Date & Time/);
  assert.match(message, /turn off Set Automatically/);
  assert.match(message, /tap Time Zone/);
  assert.match(message, /🇮🇪 Ireland/);
  assert.match(message, /Dublin \(Europe\/Dublin\)/);
});

test("multiple time zones require a region choice, not an arbitrary default", () => {
  const message = timeZoneInstructions("US");
  assert.match(message, /multiple time zones/);
  assert.match(message, /Choose the city matching your intended region/);
  assert.match(message, /and more/);
});

test("missing and invalid country codes use generic manual instructions", () => {
  for (const code of [undefined, "", "ZZ", "__proto__", "ie"]) {
    const message = timeZoneInstructions(code);
    assert.match(message, /Search for the city matching your intended region/);
    assert.doesNotMatch(message, /Not available|undefined|Dublin/);
  }
});
