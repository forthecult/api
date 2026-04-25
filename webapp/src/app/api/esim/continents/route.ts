import { NextResponse } from "next/server";

import { getEsimContinents } from "~/lib/esim-api";

export async function GET() {
  try {
    const result = await getEsimContinents();
    return NextResponse.json(result);
  } catch (error) {
    console.error("eSIM continents error:", error);
    return NextResponse.json(
      { message: "Failed to fetch continents", status: false },
      { status: 500 },
    );
  }
}
