import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, passwordChangeSchema, toFieldErrors } from "@/lib/validation";

function errors(input: Record<string, string>) {
  const parsed = passwordChangeSchema.safeParse(input);
  return parsed.success ? {} : toFieldErrors(parsed.error);
}

describe("changement de mot de passe", () => {
  it("accepte une saisie cohérente", () => {
    const parsed = passwordChangeSchema.safeParse({
      currentPassword: "ancien-mot-de-passe",
      newPassword: "nouveau-mot-de-passe",
      confirmPassword: "nouveau-mot-de-passe",
    });
    expect(parsed.success).toBe(true);
  });

  it("exige le mot de passe actuel", () => {
    expect(
      errors({ currentPassword: "", newPassword: "assez-long", confirmPassword: "assez-long" }),
    ).toHaveProperty("currentPassword");
  });

  it("refuse un nouveau mot de passe trop court", () => {
    const court = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(
      errors({ currentPassword: "ancien", newPassword: court, confirmPassword: court }),
    ).toHaveProperty("newPassword");
  });

  it("refuse une confirmation différente", () => {
    expect(
      errors({
        currentPassword: "ancien",
        newPassword: "nouveau-mot-de-passe",
        confirmPassword: "nouveau-mot-de-pass",
      }),
    ).toHaveProperty("confirmPassword");
  });

  it("refuse de reconduire le mot de passe actuel", () => {
    expect(
      errors({
        currentPassword: "meme-mot-de-passe",
        newPassword: "meme-mot-de-passe",
        confirmPassword: "meme-mot-de-passe",
      }),
    ).toHaveProperty("newPassword");
  });
});
