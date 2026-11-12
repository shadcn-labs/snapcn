import { Composition, registerRoot } from "remotion";
import { BrandWheel, brandWheelDuration } from "@/registry/snap-cn/brand-wheel";

/**
 * X post, Thu 12 Nov: the new free Brand Wheel, ten known marks ending on X.
 * speed 0.7 stretches it past X's 10s floor (x-video-ready.sh warns under 10s);
 * a <Freeze> hold froze on the wrong row, so no hold.
 */
const ITEMS =
  "YouTube, LinkedIn, Instagram, TikTok, Google, Shopify, Meta, Stripe, Product Hunt, X";
const SPEED = 0.7;
const FRAMES = Math.ceil(brandWheelDuration(ITEMS.split(",").length) / SPEED);

registerRoot(() => (
  <Composition
    id="x-brandwheel"
    component={() => (
      <BrandWheel lead="launch on" items={ITEMS} mode="dark" speed={SPEED} />
    )}
    durationInFrames={FRAMES}
    fps={30}
    width={1280}
    height={720}
  />
));
