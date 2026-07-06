import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const{id}=await params;const sql=getSql();await sql`UPDATE posts SET status='scheduled',scheduled_at=LEAST(COALESCE(scheduled_at,NOW()),NOW()),updated_at=NOW() WHERE id=${id}::uuid`;await sql`UPDATE post_targets SET status='scheduled',error_message=NULL WHERE post_id=${id}::uuid AND platform='instagram'`;return NextResponse.redirect(new URL("/posts",request.url),303)}
