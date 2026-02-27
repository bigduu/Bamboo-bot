import { describe, expect, it } from "vitest";

import { ApiError, getErrorMessage } from "./errors";

describe("getErrorMessage", () => {
  it("surfaces server-provided message for 500 errors", () => {
    const err = new ApiError(
      "Failed to reload provider: boom",
      500,
      "Internal Server Error",
    );
    expect(getErrorMessage(err)).toBe("Failed to reload provider: boom");
  });

  it("keeps friendly messages for common client errors", () => {
    const err = new ApiError("Not Found", 404, "Not Found");
    expect(getErrorMessage(err)).toBe("The requested resource was not found.");
  });
});

