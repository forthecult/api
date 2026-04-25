import { CreditCard } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/ui/primitives/card";

export default function PaymentMethodsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <CreditCard className="h-7 w-7" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Payment Methods
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Saved payment methods will appear here. You’ll be able to add, edit,
            and remove cards.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
