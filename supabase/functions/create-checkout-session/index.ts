import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 5; // 5 checkout sessions per hour per IP

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

// UUID regex pattern
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Input validation schema
const checkoutSchema = z.object({
  formSubmissionId: z.string().regex(uuidRegex, "Invalid form submission ID"),
  amount: z.number().positive("Amount must be positive").max(100000, "Amount exceeds maximum"),
  email: z.string().trim().email("Invalid email").max(255),
  fullName: z.string().trim().min(1).max(100),
});

// Sanitize string for Stripe metadata (remove special chars that could cause issues)
function sanitizeForMetadata(text: string): string {
  return text.replace(/[<>]/g, '').substring(0, 100);
}

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT-LIVE] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting checkout session creation");

    // Rate limiting check
    const clientIP = getClientIP(req);
    const { allowed } = checkRateLimit(clientIP);
    
    if (!allowed) {
      logStep("Rate limit exceeded", { ip: clientIP });
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
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

    // Verify Stripe key is available
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY not configured");
      throw new Error("Stripe not configured");
    }

    logStep("Using LIVE mode Stripe key");

    const rawBody = await req.json();

    // Validate input with Zod schema
    const parseResult = checkoutSchema.safeParse(rawBody);
    if (!parseResult.success) {
      logStep("ERROR: Validation failed", parseResult.error.flatten());
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parseResult.error.flatten().fieldErrors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { formSubmissionId, amount, email, fullName } = parseResult.data;

    logStep("Request data validated", { formSubmissionId, amount, email, fullName });

    // Initialize Stripe with live key
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Convert amount to cents
    const amountInCents = Math.round(amount * 100);

    logStep("Creating Stripe checkout session", { amountInCents });

    // Sanitize fullName for metadata
    const safeFullName = sanitizeForMetadata(fullName);

    // Create Stripe checkout session in LIVE mode
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountInCents,
            product_data: {
              name: "Donation",
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-result?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/payment-result?session_id={CHECKOUT_SESSION_ID}&canceled=1`,
      customer_email: email,
      metadata: {
        form_submission_id: formSubmissionId,
        full_name: safeFullName,
      },
    });

    logStep("Checkout session created", { 
      sessionId: session.id, 
      url: session.url,
      livemode: session.livemode
    });

    // Immediately update form_submissions with the checkout session ID
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    logStep("Updating form_submissions with session ID", { formSubmissionId });

    const { error: updateError } = await supabaseAdmin
      .from("form_submissions")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_customer_id: session.customer as string || null,
        payment_status: "pending",
      })
      .eq("id", formSubmissionId);

    if (updateError) {
      logStep("ERROR: Failed to update form_submissions", { error: updateError });
      throw updateError;
    }

    logStep("Successfully updated form_submissions", { 
      formSubmissionId, 
      sessionId: session.id 
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logStep("ERROR: Failed to create checkout session", { 
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
