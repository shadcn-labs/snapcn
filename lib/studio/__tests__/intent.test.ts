import { expect, it } from "vitest";
import { REBUILD_RE } from "../intent";

// A false positive here throws away the user's video for a "make it darker";
// a false negative sends a whole new video down the slow per-scene path.
it.each([
  "https://www.paneloui.com/ - check this site and i need proper launch video for this with clean components",
  "start over",
  "i want a new video",
  "make a promo video for Loop",
  "do it from scratch",
  "make another video",
])("rebuilds: %s", (t) => expect(REBUILD_RE.test(t)).toBe(true));

it.each([
  "make scene 2 shorter",
  "swap scene 3 for something more visual",
  "make the video darker",
  "add music to the video",
  "make the video 20 seconds",
  "the launch video needs a better hook",
])("edits: %s", (t) => expect(REBUILD_RE.test(t)).toBe(false));
