import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter for token verification attempts
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 10; // 10 verification attempts per hour per IP

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (rateLimitMap.size > 10000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) rateLimitMap.delete(key);
    }
  }
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0 };
  }
  
  record.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - record.count };
}

function getClientIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
         req.headers.get("x-real-ip") ||
         req.headers.get("cf-connecting-ip") ||
         "unknown";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting check
    const clientIP = getClientIP(req);
    const { allowed } = checkRateLimit(clientIP);
    
    if (!allowed) {
      console.log(`[verify-email-token] Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Too many verification attempts. Please try again later." 
        }),
        { 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": "3600"
          }, 
          status: 429 
        }
      );
    }

    const { token } = await req.json();

    if (!token) {
      throw new Error("Verification token is required");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the submission with this token
    const { data: submission, error: findError } = await supabase
      .from("form_submissions")
      .select("id, email, verification_sent_at")
      .eq("verification_token", token)
      .single();

    if (findError || !submission) {
      console.error("Token not found:", findError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Invalid or expired verification token" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if token already used (verification_token will be null)
    const { data: currentSubmission } = await supabase
      .from("form_submissions")
      .select("verification_token")
      .eq("id", submission.id)
      .single();

    if (!currentSubmission?.verification_token) {
      return new Response(
        JSON.stringify({ 
          success: true,
          alreadyVerified: true,
          message: "Email already verified"
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    // Check if token is expired (24 hours)
    const sentAt = new Date(submission.verification_sent_at);
    const now = new Date();
    const hoursSinceSent = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceSent > 24) {
      return new Response(
        JSON.stringify({ 
          success: false,
          expired: true,
          error: "Verification token has expired. Please request a new one." 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update the submission to mark as verified by clearing the token
    const { error: updateError } = await supabase
      .from("form_submissions")
      .update({
        verification_token: null, // Clear the token to mark as verified
      })
      .eq("id", submission.id);

    if (updateError) {
      console.error("Error updating submission:", updateError);
      throw new Error("Failed to verify email");
    }

    console.log("Email verified successfully for:", submission.email);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Email verified successfully" 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-email-token function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
