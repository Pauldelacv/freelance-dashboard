"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/lib/auth";

const loginSchema = z.object({
  password: z.string().min(1, "Saisissez votre mot de passe."),
  next: z.string().optional(),
});

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    password: formData.get("password"),
    next: formData.get("next"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const result = await signIn(parsed.data.password);
  if (!result.ok) return { error: result.error };

  // On n'accepte qu'un chemin interne, jamais une URL absolue fournie par le client.
  const next = parsed.data.next;
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  redirect(target);
}
