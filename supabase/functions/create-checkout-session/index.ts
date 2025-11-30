import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Verify Stripe key is available
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY not configured");
      throw new Error("Stripe not configured");
    }

    logStep("Using LIVE mode Stripe key");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { formSubmissionId, amount, email, fullName } = await req.json();

    logStep("Request data", { formSubmissionId, amount, email, fullName });

    if (!formSubmissionId || !amount || !email) {
      logStep("ERROR: Missing required parameters");
      throw new Error("Missing required parameters");
    }

    // Validate amount is positive
    if (amount <= 0) {
      logStep("ERROR: Invalid amount", { amount });
      throw new Error("Invalid amount");
    }

    // Initialize Stripe with live key
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Convert amount to cents
    const amountInCents = Math.round(amount * 100);

    logStep("Creating Stripe checkout session", { amountInCents });

    // Create Stripe checkout session in LIVE mode
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountInCents,
            product_data: {
              name: " ",
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
        full_name: fullName,
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
