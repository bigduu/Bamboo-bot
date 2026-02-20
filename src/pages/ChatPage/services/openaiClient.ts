import OpenAI from "openai";

import { getBackendBaseUrlSync } from "@shared/utils/backendBaseUrl";

let client: OpenAI | null = null;
let currentBaseUrl: string | null = null;

export const getOpenAIClient = (): OpenAI => {
  const baseURL = getBackendBaseUrlSync();
  if (!client) {
    client = new OpenAI({
      apiKey: "local",
      baseURL,
      dangerouslyAllowBrowser: true,
    });
    currentBaseUrl = baseURL;
  } else if (currentBaseUrl !== baseURL) {
    client = new OpenAI({
      apiKey: "local",
      baseURL,
      dangerouslyAllowBrowser: true,
    });
    currentBaseUrl = baseURL;
  }
  return client;
};
