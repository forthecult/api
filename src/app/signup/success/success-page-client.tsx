"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import {
  AuthFormHeader,
  AuthFormLayout,
} from "~/ui/components/auth/auth-form-layout";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent } from "~/ui/primitives/card";

export function SignupSuccessClient() {
  return (
    <AuthFormLayout>
      <AuthFormHeader
        subtitle="Your account is ready. Start exploring."
        title="You're all set!"
      />

 <Card className="border-none ">
        <CardContent
          className={`
          flex flex-col items-center gap-6 px-4 py-6
          sm:px-6 sm:py-8
        `}
        >
          <div
            className={`
            flex size-14 shrink-0 items-center justify-center rounded-full
            bg-primary/10 text-primary
          `}
          >
            <CheckCircle2 className="size-8" aria-hidden />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Thanks for signing up. Head to the store to browse and checkout—your
            account is ready to go.
          </p>
          <Button asChild className="w-full sm:w-auto" size="lg">
            <Link href="/">Start shopping</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthFormLayout>
  );
}
