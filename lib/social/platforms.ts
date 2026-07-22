export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "x",
  "tiktok",
  "youtube",
  "threads",
  "pinterest",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type PlatformDefinition = {
  id: SocialPlatform;
  label: string;
  shortLabel: string;
  maxCaptionLength: number;
  supportsImages: boolean;
  supportsVideo: boolean;
  supportsCarousel: boolean;
  supportsStories: boolean;
  connectionMode: "oauth" | "oauth-review";
};

export const PLATFORM_DEFINITIONS: Record<SocialPlatform, PlatformDefinition> = {
  instagram: { id: "instagram", label: "Instagram", shortLabel: "IG", maxCaptionLength: 2200, supportsImages: true, supportsVideo: true, supportsCarousel: true, supportsStories: true, connectionMode: "oauth" },
  facebook: { id: "facebook", label: "Facebook", shortLabel: "FB", maxCaptionLength: 63206, supportsImages: true, supportsVideo: true, supportsCarousel: true, supportsStories: false, connectionMode: "oauth" },
  linkedin: { id: "linkedin", label: "LinkedIn", shortLabel: "IN", maxCaptionLength: 3000, supportsImages: true, supportsVideo: true, supportsCarousel: false, supportsStories: false, connectionMode: "oauth-review" },
  x: { id: "x", label: "X", shortLabel: "X", maxCaptionLength: 280, supportsImages: true, supportsVideo: true, supportsCarousel: true, supportsStories: false, connectionMode: "oauth-review" },
  tiktok: { id: "tiktok", label: "TikTok", shortLabel: "TT", maxCaptionLength: 2200, supportsImages: true, supportsVideo: true, supportsCarousel: true, supportsStories: false, connectionMode: "oauth-review" },
  youtube: { id: "youtube", label: "YouTube", shortLabel: "YT", maxCaptionLength: 5000, supportsImages: false, supportsVideo: true, supportsCarousel: false, supportsStories: false, connectionMode: "oauth-review" },
  threads: { id: "threads", label: "Threads", shortLabel: "TH", maxCaptionLength: 500, supportsImages: true, supportsVideo: true, supportsCarousel: true, supportsStories: false, connectionMode: "oauth" },
  pinterest: { id: "pinterest", label: "Pinterest", shortLabel: "PI", maxCaptionLength: 500, supportsImages: true, supportsVideo: true, supportsCarousel: false, supportsStories: false, connectionMode: "oauth-review" },
};

export function isSocialPlatform(value: string): value is SocialPlatform {
  return SOCIAL_PLATFORMS.includes(value as SocialPlatform);
}

export function platformLabel(platform: SocialPlatform) {
  return PLATFORM_DEFINITIONS[platform].label;
}

export function defaultTargetFormat(platform: SocialPlatform, mediaType: string) {
  if (platform === "youtube" && mediaType === "photo") return "video";
  if (platform === "linkedin" && mediaType === "story") return "photo";
  return mediaType;
}
