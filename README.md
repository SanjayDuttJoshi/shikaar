# 🔦 SHIKAAR

A first-person co-op horror game in the browser. You and up to 5 friends are locked inside an abandoned building at 2:47 am: the **Purana Pagalkhana** (asylum) or the **Purani Haveli**. Find the keys, carry the fuses to the fuse box, get the main gate open and get out before the things living there find you.

**Play:** https://sanjayduttjoshi.github.io/shikaar/

- **Three monsters**, each hunting its own way: the Chowkidar with his red lantern roams everywhere; the blind Mareez hears every step; the Chudail goes into a rage if you stare at her.
- **Hide** in lockers, almirahs or under beds. **Flash** your torch to freeze a monster for a moment.
- **Scares**: a body dropping from the ceiling, someone crying in a corner, a cat, a rooster, a rocking chair, a radio that turns itself on.
- **Story**: envelopes hidden in rooms play short in-engine films about what happened there.
- **Hindi or English** voices for every line, subtitles included.
- **Squad mode**: one friend opens a room, the others join with the 5-letter code or the invite link (WhatsApp button included). Bigger squads get a bigger building, more fuses and more monsters. Downed friends can be picked back up; when you're out you watch a friend still inside. The squad list (top right) shows how many are in; tap a friend's name (or press 1–5 on a laptop) to see through their eyes for a moment, and walk or tap again to come back.
- Desktop (WASD or arrows, rebindable keys) and phones (touch sticks).

## 100% free, no server

| Piece | What it uses | Cost |
|---|---|---|
| Website | Static files on GitHub Pages | Free |
| Finding friends | Public Nostr relays via [Trystero](https://github.com/dmotz/trystero) | Free, no account |
| Game traffic | Direct WebRTC between browsers (encrypted) | Free |
| Models, textures, sounds | CC0 / free sources, see `public/assets/CREDITS*.md` | Free |

There is no database, no login and no paid API. The friend who opens the room runs the monsters for everyone, so they should keep the game open in front; if they leave, the round ends and someone else becomes host.

**Known limits:** players in a room can see each other's IP address (normal for direct browser-to-browser games). A few strict networks (some office or college Wi-Fi, some carrier NATs) block direct connections; switching to mobile data or a hotspot usually fixes it.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run preview    # production build at http://localhost:4175
npm test           # unit tests
npm run test:e2e   # browser tests (Chrome)
npm run deploy     # publish to GitHub Pages
```

Add `?net=local` to the URL to play a squad between tabs of one browser (handy for testing).
