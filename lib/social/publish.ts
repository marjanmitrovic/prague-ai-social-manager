import { publishFacebook } from "@/lib/social/facebook";
import { publishInstagram } from "@/lib/social/instagram";
import { publishLinkedIn } from "@/lib/social/linkedin";
import { publishPinterest } from "@/lib/social/pinterest";
import { publishThreads } from "@/lib/social/threads";
import { publishTikTok } from "@/lib/social/tiktok";
import { publishX } from "@/lib/social/x";
import { publishYouTube } from "@/lib/social/youtube";
import { platformLabel } from "@/lib/social/platforms";
import type { SocialPlatform } from "@/lib/social/platforms";

export type PublishAsset = {
  url: string;
  resourceType: "image" | "video" | "raw";
};

export type PublishAccount = {
  external_account_id: string;
  access_token_encrypted: string;
};

export type PublishInput = {
  platform: SocialPlatform;
  account: PublishAccount;
  mediaType: string;
  media: PublishAsset[];
  caption: string;
  title?: string;
};

export type PublishResult = {
  externalPostId: string;
};

export class ManualPublishingRequiredError extends Error {
  readonly platform: SocialPlatform;

  constructor(platform: SocialPlatform, message?: string) {
    super(message || `${platformLabel(platform)} vyžaduje dokončení API připojení.`);
    this.name = "ManualPublishingRequiredError";
    this.platform = platform;
  }
}

export async function publishToPlatform(input: PublishInput): Promise<PublishResult> {
  switch (input.platform) {
    case "instagram":
      return publishInstagram({
        account: input.account,
        mediaType: input.mediaType,
        media: input.media,
        caption: input.caption,
      });
    case "facebook":
      return publishFacebook(input);
    case "linkedin":
      return publishLinkedIn(input);
    case "x":
      return publishX(input);
    case "tiktok":
      return publishTikTok(input);
    case "youtube":
      return publishYouTube(input);
    case "threads":
      return publishThreads(input);
    case "pinterest":
      return publishPinterest(input);
  }
}
