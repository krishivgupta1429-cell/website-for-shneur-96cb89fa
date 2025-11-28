import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubmitEntryBody {
  full_name: string;
  email: string;
  phone_number?: string | null;
  full_phone?: string | null;
  number_of_participants: number;
  join_menorah_lighting: boolean;
  join_chanukah_party: boolean;
  sponsorships: string[];
  other_donation?: number | null;
  wants_to_donate?: boolean;
  verification_token: string;
  verification_sent_at: string;
}

async function sendRegistrationEmail(fullName: string, email: string): Promise<void> {
  try {
    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) {
      throw new Error("Missing BREVO_API_KEY");
    }

    const htmlContent = `Hi ${fullName},<br/><br/>
      Thank you so much for signing up for Menorah at the Falls—we can't wait to celebrate with you!<br/><br/>
      📍 <strong>Location:</strong> Riverside Park<br/>
      🕔 <strong>Event Start Time:</strong> 5:00 PM<br/>
      📅 <strong>Date:</strong> December 25th<br/><br/>
      Your participation helps bring warmth and light to our whole community.<br/><br/>
      To help spread the light even further, would you consider forwarding the event sign-up to five friends?<br/><br/>
      Here's the link: <a href="https://menorah.jewishtc.org/">https://menorah.jewishtc.org/</a><br/><br/>
      If you have any questions at all, feel free to reach out anytime.<br/>
      Looking forward to celebrating together!<br/><br/>
      Warmly,<br/>
      Rabbi Laibel & Chaya Shemtov<br/>
      Chabad Jewish Center of Traverse City<br/>
      <a href="https://JewishTC.org">JewishTC.org</a><br/><br/>
      <strong>P.S.</strong> Congratulations on being among the first 100 sign-ups!<br/>
      Please show this email when you arrive to receive your free beanie.<br/>
      Be sure to show it before 5:05 PM—after that time, we'll begin giving them out to everyone.<br/><br/>
      <strong>P.S.s</strong><br/>
      View the lamplighter wall:<br/>
      <a href="https://www.jewishtc.org/templates/articlecco_cdo/aid/7109138/jewish/Untitled.htm">https://www.jewishtc.org/templates/articlecco_cdo/aid/7109138/jewish/Untitled.htm</a>`;

    const payload = {
      sender: { name: "Rabbi Laibel Shemtov", email: "rabbi@jewishtc.org" },
      to: [{ email, name: fullName }],
      bcc: [{ email: "laibelswb@gmail.com", name: "Rabbi Laibel" }],
      subject: "You're Registered for Menorah at the Falls!",
      htmlContent,
    };

    console.log(`[email] Attempting to send registration email to ${email}...`);

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brevo API error: ${response.status} - ${errorText}`);
    }
    
    console.log(`[email] Sent successfully to ${email}`);
  } catch (error) {
    console.error(`[email] Error: ${error}`);
    // Don't throw - we don't want email failures to block form submission
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = (await req.json()) as Partial<SubmitEntryBody>;

    // Minimal validation of required fields
    if (!body.full_name || !body.email || !body.verification_token || !body.verification_sent_at || body.number_of_participants === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Prepare insert payload with new schema
    const insertPayload = {
      full_name: body.full_name.trim(),
      email: body.email.trim().toLowerCase(),
      phone_number: body.phone_number?.trim() ?? null,
      full_phone: body.full_phone?.trim() ?? null,
      number_of_participants: body.number_of_participants,
      join_menorah_lighting: body.join_menorah_lighting ?? false,
      join_chanukah_party: body.join_chanukah_party ?? false,
      sponsorships: body.sponsorships ?? [],
      wants_to_donate: body.wants_to_donate ?? false,
      verification_token: body.verification_token,
      verification_sent_at: body.verification_sent_at,
      payment_status: body.wants_to_donate ? "pending" : "none",
    };

    const { data, error } = await supabaseAdmin
      .from("form_submissions")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.error("[submit-form-entry] Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Insert failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Send registration confirmation email only for NON-donors
    // Donors will receive their combined email after payment success
    if (!body.wants_to_donate) {
      sendRegistrationEmail(body.full_name, body.email).catch(err => {
        console.error("[submit-form-entry] Email sending failed but continuing:", err);
      });
    }

    return new Response(JSON.stringify({ id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("[submit-form-entry] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Unexpected error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});