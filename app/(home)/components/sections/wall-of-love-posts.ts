/**
 * Real posts about snapcn, pulled from X (and the odd one from Threads).
 *
 * Every entry is a real public post — `url` is the source, `quote` is that
 * post's own words. Nothing here is written by us, which is the only thing
 * that makes a wall like this worth having.
 *
 * ## Quoting policy
 *
 * `quote` is verbatim, with three mechanical edits and no others:
 *   - `t.co` shortlinks dropped (they render as noise and the card already
 *     links to the post),
 *   - a leading `@handle` dropped when the post is a reply,
 *   - a trailing `…` where X itself cut the text off, or where we kept the
 *     opening of a long post. The card links out, so the full text is one
 *     click away — but the ellipsis has to be there, or we are quoting
 *     someone as having finished a sentence they did not.
 *
 * Posts are not translated. Half of these are in Spanish, Portuguese or
 * Chinese and they stay that way: a translated quote is our words in
 * someone else's mouth. `lang` is set per card so screen readers and font
 * fallback both get it right.
 *
 * ## Avatars
 *
 * Copied into `public/wall-of-love/` rather than hotlinked from
 * `pbs.twimg.com` — hotlinking needs a `remotePatterns` entry, and it breaks
 * silently the day someone changes their profile picture.
 *
 * ## Verified
 *
 * `verified` is X's own `user.is_blue_verified`, read off the post — not a
 * judgement of ours about who is worth a badge. Not every author below has
 * one, and they keep their card exactly as it is: a wall that only shows
 * the flag when it is really there is worth something, and one that decorates
 * every card is worth nothing.
 *
 * To add a post: append an entry. Fetch the fields with
 * `https://cdn.syndication.twimg.com/tweet-result?id=<status id>&token=a` —
 * `user.is_blue_verified` is the badge, `user.name` the display name — and save
 * the author's `profile_image_url_https` (swap `_normal` for `_400x400`) into
 * `public/wall-of-love/<handle>.jpg`.
 */
export interface WallPost {
  /** X handle, without the `@`. Doubles as the avatar filename. */
  handle: string;
  /** Display name as it appears on the post. */
  name: string;
  /** BCP-47 tag for the quote — set on the element, not just for show. */
  lang: string;
  /** ISO date of the post, for the `<time>` element. */
  date: string;
  url: string;
  quote: string;
  /** X's `user.is_blue_verified` at the time the post was added. */
  verified?: boolean;
  /** Who they are, when that is the reason the quote matters. */
  role?: string;
}

/**
 * The quote above the hero and the pricing cards — from the person who made
 * Remotion, which is the endorsement a Remotion registry can least argue with.
 *
 * Only the post's first sentence, and without a trailing `…`: it is a whole
 * sentence, and the rest of the post ("We wanna collaborate, will reach out
 * soon!") is a separate thought, not the end of this one. The reply's leading
 * `@blessed_ux @Remotion` is dropped per the policy above. Not in `WALL_POSTS`,
 * so the wall below keeps its own set.
 */
export const FEATURED_POST: WallPost = {
  handle: "JNYBGR",
  name: "Jonny Burger",
  role: "Creator of Remotion",
  lang: "en",
  date: "2026-08-24",
  url: "https://x.com/JNYBGR/status/2091908167370215696",
  quote: "Snapcn actually has very nice components.",
  verified: true,
};

export const WALL_POSTS: readonly WallPost[] = [
  {
    handle: "nett0eth",
    name: "Nett0",
    lang: "pt",
    date: "2026-08-18",
    url: "https://x.com/nett0eth/status/2089765497201983501",
    quote:
      "esse repositório aqui está em outro nível 🤯\ne é tudo de graça\n\n20 componentes de Remotion, prontos pra copiar e colar no teu projeto: título animado, logo sting e mockup de tela. roda com um comando CLI\n\nsem conta, sem chave, sem plano pago",
    verified: true,
  },
  {
    handle: "appariciojunior",
    name: "AJ",
    lang: "pt",
    date: "2026-08-20",
    url: "https://x.com/appariciojunior/status/2090392089976537504",
    quote: "eitaaaaaaaaa, biblioteca premium aqui hein",
    verified: true,
  },
  {
    handle: "ricouii",
    name: "RicoUI",
    lang: "zh",
    date: "2026-08-20",
    url: "https://x.com/ricouii/status/2090263283320443045",
    quote:
      "Snapcn 这个 Remotion 视频方案比 Skills 稳定多了\n\n简单的说就是视频模板，不过是用代码实现精准的动效动画，然后渲染视频。现在把素材库抽离出来，方便直接更换素材，简单但效果稳定。\n\n目前内置 22 个视频模板，侧重产品演示，有非常大的扩展空间，我先 fork 过来二开！",
    verified: true,
  },
  {
    handle: "Easycompany333",
    name: "Easycompany",
    lang: "zh",
    date: "2026-08-19",
    url: "https://x.com/Easycompany333/status/2089935106438033461",
    quote:
      "做产品演示视频时，最磨人的经常是那几秒镜头：AI 回复逐字出现、终端命令滚动、手机框入场、字幕跟着声音走。\n\nSnapCN 把这些镜头做成了可复制的 React 组件。你可以把它理解成「视频版 shadcn/ui」…",
    verified: true,
  },
  {
    handle: "TellusCoop",
    name: "Tellus Cooperative 🌎",
    lang: "es",
    date: "2026-08-24",
    url: "https://x.com/TellusCoop/status/2091877130992820268",
    quote:
      "Crea videos de demostración de productos con código.\nsnapcn ofrece componentes para Remotion, facilitando la creación de videos profesionales.\n→ Componentes listos para efectos de texto, marcos de dispositivos y terminales…",
    verified: true,
  },
  {
    handle: "TheTechDiggest",
    name: "AI Tech Diggest",
    lang: "en",
    date: "2026-08-20",
    url: "https://x.com/TheTechDiggest/status/2090341940810191256",
    quote:
      "Stop manually editing product videos and start generating programmatic animations directly inside your React codebase today.",
    verified: true,
  },
  {
    handle: "crytonbuton",
    name: "Cryton",
    lang: "en",
    date: "2026-08-21",
    url: "https://x.com/crytonbuton/status/2090701990464528724",
    quote:
      "The copy-paste model is interesting because it turns video design into reusable code instead of another specialized editing workflow.",
  },
  {
    handle: "yyyole",
    name: "沐阳",
    lang: "zh",
    date: "2026-08-20",
    url: "https://x.com/yyyole/status/2090318175959437645",
    quote: "转需！应该能用到！\n一键就能调用的 Remotion 动效组件！！",
    verified: true,
  },
  {
    handle: "maximedesogus",
    name: "Maxime De Sogus",
    lang: "en",
    date: "2026-09-02",
    url: "https://x.com/maximedesogus/status/2095141743825957288",
    quote:
      "Not bad, with more time, I think result can be very good. Made with @snapcndev + Fable 5",
  },
  {
    handle: "cky011",
    name: "ck y",
    lang: "en",
    date: "2026-09-26",
    url: "https://x.com/cky011/status/2103762154604400919",
    quote:
      "Claude Opus 5.5 made the launch film for my app. Still stunned. 🎬\n\nEvery frame is code, built with @Remotion and @snapcndev.\n\nThe app is MemoBerry 🫐, a multi-agent AI study companion…",
    verified: true,
  },
  {
    handle: "mannupaaji",
    name: "Manu Arora",
    lang: "en",
    date: "2026-10-12",
    url: "https://x.com/mannupaaji/status/2109665445775327389",
    quote: "Lets goo! 💯",
    verified: true,
  },
  {
    handle: "positronx_",
    name: "Shubhu",
    lang: "en",
    date: "2026-10-12",
    url: "https://x.com/positronx_/status/2109635390714110030",
    quote: "banger for motion designers",
  },
  {
    handle: "zanbuilds",
    name: "zan",
    lang: "en",
    date: "2026-10-12",
    url: "https://x.com/zanbuilds/status/2109687273453236699",
    quote:
      "damn life just got much easier \n\nlet your agent install this , give it your taste and watch it cook the video for you",
    verified: true,
  },
  {
    handle: "bydhruvil",
    name: "dhru",
    lang: "en",
    date: "2026-10-13",
    url: "https://x.com/bydhruvil/status/2109887391024738389",
    quote: "this is crazy, can't wait to try it",
    verified: true,
  },
  {
    handle: "ivaavimusic",
    name: "Ivaavi.eth",
    lang: "en",
    date: "2026-10-14",
    url: "https://x.com/ivaavimusic/status/2110352021954212186",
    quote:
      "Btw this whole video is AI-generated.\n\nTook me ~30 minutes, a few Skills, and a GLM 5.3 coding plan from @Zai_org.\n\nDid a few screen recordings, generated the rest with @snapcndev and @HyperFrames_ using GLM 5.3, then stitched everything together manually in FilmCraft, with…",
    verified: true,
  },
  {
    handle: "koustavdotco",
    name: "Koustav",
    lang: "en",
    date: "2026-10-15",
    url: "https://x.com/koustavdotco/status/2110851548016464109",
    quote:
      "Omnicast is already live on the Omarchy marketplace, but I wanted to try making a product launch video for it using Gemini 3.8 Flash and @snapcndev .\n  \nHere is how it turned out:",
    verified: true,
  },
  {
    handle: "meszmatew",
    name: "Matt",
    lang: "en",
    date: "2026-10-19",
    url: "https://x.com/meszmatew/status/2112144333046485348",
    quote:
      "We open-sourced a Zendesk alternative and it went VIRAL. \n\nConnect your support@ inbox. Plug in any tool via MCP. Pay $0. \nIt's called Opendesk 👇 \n\n🎬 video made with @snapcndev",
    verified: true,
  },
  {
    handle: "ZhenHan261538",
    name: "Zhen Han",
    lang: "en",
    date: "2026-10-12",
    url: "https://x.com/ZhenHan261538/status/2109746249142505879",
    quote:
      "snapcn (Open source, 100% free) dropped today. I'm skeptical of every video tool, so I tried it on one of my own products, Appifex.\n\nThis video is made entirely in Claude Code (Opus 5.5). Zero UI tools, just prompts:\n\n1.  install snapcn\n\n2. set it up for my product videos\n\n3.…",
    verified: true,
  },
  {
    handle: "colinsinglxton",
    name: "Colin Singleton",
    lang: "en",
    date: "2026-10-12",
    url: "https://x.com/colinsinglxton/status/2109652373610140035",
    quote:
      "Shadcn drops Snapcn for 100% FREE. I reccomended you\n\n1. Get it connected to your @bot Agents\n\n2. Connect that agent with a cloud cursor claude terminal\n\n3. Add the /brag repo and add snapcn as a componenet list for creating demo videos.\n\n4. Success",
    verified: true,
  },
  {
    handle: "tatsuo1020",
    name: "大瀧 達生 / 株式会社◯ / AI研究 / 地方創生 /",
    lang: "ja",
    date: "2026-10-12",
    url: "https://x.com/tatsuo1020/status/2109758169526493618",
    quote:
      "製品デモ動画をコードで作るためのRemotionコンポーネント集「snapcn」。\n\nshadcn CLIで導入でき、ソースを自分で改変できる完全オープンソース。",
    verified: true,
  },
  {
    handle: "techmeat",
    name: "Serg Eroshe",
    lang: "en",
    date: "2026-10-12",
    url: "https://x.com/techmeat/status/2109742403284607213",
    quote:
      "Gave Claude Code the snapcn link, asked it to install it and draft a script for a promo of wattcost, my small open-source tool for Ubuntu. I approved the script, and the video was done. Suno did the music from Claude's prompt.\n\n~10 minutes, one shot.",
    verified: true,
  },
  {
    handle: "alexmichaelio",
    name: "Alex",
    lang: "en",
    date: "2026-10-13",
    url: "https://x.com/alexmichaelio/status/2109856880369758426",
    quote:
      "When anyone can ship a product, the demo is what gets you noticed. \n\nBookmark this before you launch anything",
    verified: true,
  },
  {
    handle: "citewireai",
    name: "Citewire",
    lang: "en",
    date: "2026-10-13",
    url: "https://x.com/citewireai/status/2109876065317634499",
    quote:
      "Snapcn gives you editable React shots for product videos: animated titles, terminals, device frames and scripted AI chat.\n\nWe tried its free browser editor and exported the three-second 720p30 title below without signing in. This is a small template test, not a full product…",
    verified: true,
  },
  {
    handle: "jqueryscript",
    name: "jQueryScript",
    lang: "en",
    date: "2026-10-13",
    url: "https://x.com/jqueryscript/status/2109848226878947384",
    quote:
      "Product demos need precise AI chat, terminal, and device shots. \n\nsnapcn installs those scenes as editable Remotion TSX via shadcn. Script the timing and render an MP4. \n\n👉",
    verified: true,
  },
  {
    handle: "suge_ai",
    name: "苏格",
    lang: "zh",
    date: "2026-10-13",
    url: "https://x.com/suge_ai/status/2109992574328955007",
    quote:
      "做产品发布视频，终于不用录屏硬剪了 \n\nsnapcn 刚开源：一套 shadcn 风格的 Remotion 组件，用 React 代码就能拼出产品演示视频。AI 对话流、终端、设备外框、字幕、Logo 动画都有现成的。\n\n一条命令把源码拷进项目，想怎么改就怎么改，免费",
    verified: true,
  },
  {
    handle: "ManuAGI01",
    name: "ManuAGI 🤖 - ( ManuIn )",
    lang: "en",
    date: "2026-10-18",
    url: "https://x.com/ManuAGI01/status/2111880358790840414",
    quote:
      "🚀Project Number 10 - snapcn 🔥\n\n'Remotion video components installed with the shadcn CLI'\n\n#opensource #githubprojects #developer #programming #devtools #aiagents #aicoding\n#snapcn",
    verified: true,
  },
  {
    // From Threads, not X: `verified` is the Threads badge on the post.
    handle: "aiposthub",
    name: "aiposthub",
    lang: "zh-Hant",
    date: "2026-10-12",
    url: "https://www.threads.com/@aiposthub/post/DebGn6gganM",
    quote:
      "甚至還提供 AI Agent Skill，可以搭配 AI Coding 工具協助挑選元件、安排動畫時間軸。\n\n以後要製作 SaaS 產品介紹、AI 工具 Demo、功能宣傳短片，又多了一個超強選擇！…",
    verified: true,
  },
  {
    handle: "Creator_Toolbox",
    name: "Creators Toolbox",
    lang: "en",
    date: "2026-11-02",
    url: "https://x.com/Creator_Toolbox/status/2117390617433240047",
    quote:
      "snapcn turns launch videos into something you git push\n\nIt's a library of ready-made Remotion video components you install into your project and own outright, so the video lives right next to your code",
    verified: true,
  },
  {
    handle: "lokidotdev",
    name: "Loki",
    lang: "en",
    date: "2026-10-28",
    url: "https://x.com/lokidotdev/status/2115566365222572538",
    quote:
      "You're losing launch-day attention if your video looks like everyone else's.\n\nSnapcn has ready-made templates that make product launches feel premium in minutes.\n\nYour next launch shouldn't be boring.",
    verified: true,
  },
  {
    handle: "zzurcz",
    name: "Rhuan",
    lang: "pt",
    date: "2026-11-02",
    url: "https://x.com/zzurcz/status/2117286035700760900",
    quote: "usei o snapcn pra componets de motion…",
    verified: true,
  },
  {
    handle: "HeyDetya",
    name: "Hey Detya",
    lang: "en",
    date: "2026-10-30",
    url: "https://x.com/HeyDetya/status/2116224431454589165",
    quote:
      "Motion as an npm install is such a good idea. Designers will love this 🔥",
    verified: true,
  },
  {
    handle: "JerelVelarde",
    name: "Jerel Velarde",
    lang: "en",
    date: "2026-10-30",
    url: "https://x.com/JerelVelarde/status/2116028996257472998",
    quote: "watch out",
    verified: true,
  },
] as const;
