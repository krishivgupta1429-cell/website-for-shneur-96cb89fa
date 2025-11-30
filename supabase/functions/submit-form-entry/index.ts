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
  number_of_participants?: number | null;
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

    const htmlContent = `
<p>Dear ${fullName},</p>

<p>Thank you for registering for <strong>"Menorah at the Falls"</strong>. See you on the first night of Chanukah, Sunday, December 14 at 5pm!</p>

<p><strong>"The event begins at Riverside Park"</strong>. Enjoy a fire show and hot drinks at 5pm, followed by the Menorah lighting and a Gelt Drop from a fire truck at 5:30pm.</p>

<p>To donate to this event and year-round Jewish programming, please visit <a href="https://jewishchagrinfalls.com/donate">jewishchagrinfalls.com/donate</a>.</p>

<p><strong>"After the lighting, the celebration continues up the street at Chabad at the Falls,"</strong> 100 N Main Street, Suite 100. Join a Chanukah party with latkes, donuts, children's activities, and fun for the whole family.</p>

<hr>

<p>You can also join us at the <strong>"Triangle bandstand each night of Chanukah for a Menorah lighting ceremony,"</strong> December 15 through December 21 at 7pm. Full schedule at <a href="https://jewishchagrinfalls.com/chanukah">jewishchagrinfalls.com/chanukah</a>.</p>
`;

    const payload = {
      sender: { name: "Menorah at the Falls", email: "Rabbi@jewishchagrinfalls.com" },
      to: [{ email, name: fullName }],
      cc: [
        { email: "Rabbi@jewishchagrinfalls.com", name: "Rabbi" },
        { email: "simi@jewishchagrinfalls.com", name: "Simi" }
      ],
      bcc: [{ email: "laibelswb@gmail.com", name: "Internal" }],
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
    if (!body.full_name || !body.email || !body.verification_token || !body.verification_sent_at) {
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
      number_of_participants: body.number_of_participants ?? 1,
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
