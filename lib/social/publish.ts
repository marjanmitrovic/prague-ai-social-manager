import { publishInstagram } from "@/lib/social/instagram";
import { platformLabel, SocialPlatform } from "@/lib/social/platforms";

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
    case "linkedin":
    case "x":
    case "tiktok":
    case "youtube":
    case "threads":
    case "pinterest":
      throw new ManualPublishingRequiredError(
        input.platform,
        `${platformLabel(input.platform)} je připravený v univerzálním workflow, ale automatické odeslání vyžaduje OAuth připojení a schválený přístup k publikačnímu API.`
      );
  }
}
