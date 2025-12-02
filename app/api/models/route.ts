
import { NextResponse } from "next/server";
import { getMODELS } from "@/lib/providers";

export const dynamic = 'force-dynamic'; // Ensure this route is never cached

export async function GET() {
  try {
    const models = await getMODELS();
    return NextResponse.json(models);
  } catch (error) {
    console.error("Failed to fetch models:", error);
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
  }
}
