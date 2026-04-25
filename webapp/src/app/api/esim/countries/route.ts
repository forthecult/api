import { NextResponse } from "next/server";

import { getEsimCountries } from "~/lib/esim-api";

export async function GET() {
  try {
    const result = await getEsimCountries();
    return NextResponse.json(result);
  } catch (error) {
    console.error("eSIM countries error:", error);
    return NextResponse.json(
      { message: "Failed to fetch countries", status: false },
      { status: 500 },
    );
  }
}
