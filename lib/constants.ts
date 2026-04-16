export const APP_NAME = "FlowIQ";
export const APP_VERSION = "1.0.0-mvp";

export const INDUSTRIES = ["SEO", "AMAZON", "WEB_DESIGN"] as const;

export type Industry = (typeof INDUSTRIES)[number];
