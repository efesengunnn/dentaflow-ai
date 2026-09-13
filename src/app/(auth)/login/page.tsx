"use client";

import { useActionState } from "react";

import { BrandMark } from "@/components/layout/brand-mark";
import { login } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, undefined);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
            <BrandMark className="size-4.5" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            DentaFlow AI
          </h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Giriş Yap</CardTitle>
            <CardDescription>
              Klinik hesabınıza giriş yapmak için e-posta ve şifrenizi girin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">E-posta</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="ornek@klinik.com"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Şifre</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </Field>
                {state?.error ? <FieldError>{state.error}</FieldError> : null}
                <Button type="submit" loading={isPending} className="w-full">
                  Giriş Yap
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
