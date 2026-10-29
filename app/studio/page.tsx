import type { Metadata } from "next";
import { auth } from "@/auth";
import { Studio } from "@/components/studio/studio";
import { planFor } from "@/lib/server/entitlements";

export const metadata: Metadata = {
  title: "Studio — direct a video with AI · snapcn",
  description:
    "Describe your product and get a first cut built from snapcn's animated scenes. Select any scene and give notes, then export an MP4. Free, in the browser.",
  alternates: { canonical: "/studio" },
};

// Session and plan are read here, as on the editor page, so the studio never
// renders a watermark claim it then has to take back.
export default async function StudioPage() {
  const session = await auth().catch(() => null);
  const { limits } = await planFor(session?.user?.id ?? null);

  return (
    <>
      <h1 className="sr-only">snapcn Studio</h1>
      <Studio
        signedIn={Boolean(session?.user)}
        canRemoveWatermark={!limits.watermark}
      />
    </>
  );
}
