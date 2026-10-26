# Sunny Acres online play: the Selebox app's side (React Native)

The game is one offline HTML page and makes **no network calls**. For online play (visiting farms, seeing each
other live, likes, gifts, friends, chat, ranks) it asks the app, and the app answers with **its own signed-in
Supabase client**. Players never sign in inside the game: they are online with their Selebox account.

`sunnyAcresBridge.js` does all of this. It has no dependencies and works with `react-native-webview` and
`@supabase/supabase-js` v2, which the app already has.

## Before you start

1. The database script `supabase/farm_online.sql` must be applied to the Selebox Supabase project (once).
2. Realtime must be on for the project. The game uses **private** channels named `farm:<user id>`. The script
   adds the two policies on `realtime.messages` that allow them.

## Add it to the screen that opens the game

Copy `sunnyAcresBridge.js` into the app (for example `src/games/sunnyAcresBridge.js`), then:

```jsx
import React, { useEffect, useMemo, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { supabase } from '../lib/supabase'; // the app's existing, signed-in client
import { createSunnyAcresBridge } from './sunnyAcresBridge';

export default function SunnyAcresScreen() {
  const webViewRef = useRef(null);
  const bridge = useMemo(() => createSunnyAcresBridge({ supabase, webViewRef }), []);
  useEffect(() => () => bridge.dispose(), [bridge]); // leaves the live channels when the screen closes

  return (
    <WebView
      ref={webViewRef}
      source={/* the game's index.html, as you load it today */}
      originWhitelist={['*']}
      javaScriptEnabled
      // the bridge's script first, then your own gameHost setup (save/state/quiet) as today
      injectedJavaScriptBeforeContentLoaded={bridge.injectedJavaScriptBeforeContentLoaded + yourGameHostScript}
      onMessage={(event) => {
        if (bridge.onMessage(event)) return; // the game's online calls
        // ...your own messages from the game (save, back, ...) as today
      }}
    />
  );
}
```

That is all. The bridge only adds `window.gameHost.net`. Your existing `window.gameHost.state`,
`window.gameHost.save(...)`, `__gameSleep` and `__gameBack` keep working as they are. If your gameHost script
replaces the whole `window.gameHost` object, assign to its fields instead (`window.gameHost = window.gameHost || {};
window.gameHost.save = ...`), so `gameHost.net` is not lost.

## What the game can and cannot do through the bridge

- It can call only the database functions named `farm_..._v1` (from `supabase/farm_online.sql`). Any other name
  is refused before it reaches Supabase.
- It can join only channels named `farm:<uuid>`, and send only short event names (`mv`, `emote`, `like`, `gift`).
- Calls run as the signed-in user, with the same Row Level Security as the rest of the app. The farm functions
  check everything again on the server (limits on gifts, likes and messages, friends only, bans).
- The game never sees the login token.

## Messages, for reference

Game to app (`window.ReactNativeWebView.postMessage`, JSON with `__sunnyNet: 1`):

| op | args | answer |
| --- | --- | --- |
| `session` | `[]` | the signed-in user's id, or `null` |
| `rpc` | `[name, args]` | `supabase.rpc(name, args)` data, or an error |
| `join` | `[ch, topic, state]` | opens the channel; presence and broadcasts are then pushed to the game |
| `track` | `[ch, state]` | updates our presence |
| `send` | `[ch, event, payload]` | broadcasts to the others on the channel |
| `leave` | `[ch]` | leaves the channel |

App to game (`webViewRef.current.injectJavaScript`): `window.__sunnyNet.reply(id, ok, value)` and
`window.__sunnyNet.event(ch, 'presence', others)` / `window.__sunnyNet.event(ch, 'message', event, payload)`.

## Testing

`test/bridge.test.js` runs this file against a stand-in for Supabase. `test/e2e-online.test.js` runs three
phones (an owner and two visitors) through it in a real browser. On devices: sign in to Selebox with 2 or 3
accounts, open Sunny Acres, and visit each other from the Online button.
