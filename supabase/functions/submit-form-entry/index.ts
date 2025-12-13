import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const submitEntrySchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().trim().email("Invalid email").max(255, "Email too long").toLowerCase(),
  phone_number: z.string().trim().max(30, "Phone too long").nullable().optional(),
  full_phone: z.string().trim().max(50, "Phone too long").nullable().optional(),
  number_of_participants: z.number().int().min(1).max(100).default(1),
  join_menorah_lighting: z.boolean().default(false),
  join_chanukah_party: z.boolean().default(false),
  sponsorships: z.array(z.string().max(100)).max(10).default([]),
  other_donation: z.number().min(0).max(100000).nullable().optional(),
  wants_to_donate: z.boolean().default(false),
  verification_token: z.string().min(1, "Token required").max(100),
  verification_sent_at: z.string().min(1, "Timestamp required"),
});

// HTML escape function to prevent email injection
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

async function sendRegistrationEmail(
  fullName: string,
  email: string,
  joinMenorahLighting: boolean,
  numberOfParticipants: number
): Promise<void> {
  try {
    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) {
      throw new Error("Missing BREVO_API_KEY");
    }

    // Escape user inputs for HTML email
    const safeFullName = escapeHtml(fullName);

    // Build attending lines - only Menorah lighting (Chanukah party is full)
    const attendingLines: string[] = [];
    if (joinMenorahLighting) {
      attendingLines.push('Menorah lighting at Riverside Park');
    }
    const attendingHtml = attendingLines.length > 0 
      ? attendingLines.join('<br>') 
      : 'Not specified';

    const htmlContent = `
<p>Dear ${safeFullName},</p>

<p>Thank you for registering for <strong>Menorah at the Falls</strong>. See you on the first night of Chanukah, Sunday, December 14 at 5pm!</p>

<p><strong>The event begins at Riverside Park.</strong> Enjoy a fire show and hot drinks at 5pm, followed by the Menorah lighting and a Gelt Drop from a fire truck at 5:30pm.</p>

<p>To donate to this event and year-round Jewish programming, please visit <a href="https://jewishchagrinfalls.com/donate">jewishchagrinfalls.com/donate</a>.</p>

<p>All are welcome to attend the Menorah lighting at Riverside Park. The Chanukah party at Chabad is full.</p>

<p>--</p>

<p>You can also join us at the <strong>Triangle bandstand each night of Chanukah for a Menorah lighting ceremony,</strong> December 15 through December 21 at 7pm. Full schedule at <a href="https://jewishchagrinfalls.com/chanukah">jewishchagrinfalls.com/chanukah</a>.</p>

<p><strong>Attending:</strong><br>
${attendingHtml}
<br><br>
<strong>Number of participants:</strong> ${numberOfParticipants}
</p>
`;

    const payload = {
      sender: { name: "Menorah at the Falls", email: "Rabbi@jewishchagrinfalls.com" },
      to: [{ email, name: safeFullName }],
      cc: [
        { email: "Rabbi@jewishchagrinfalls.com", name: "Rabbi" },
        { email: "simi@jewishchagrinfalls.com", name: "Simi" }
      ],
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

    const rawBody = await req.json();

    // Validate input with Zod schema
    const parseResult = submitEntrySchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.error("[submit-form-entry] Validation error:", parseResult.error.flatten());
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parseResult.error.flatten().fieldErrors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const body = parseResult.data;

    // Prepare insert payload with validated data
    const insertPayload = {
      full_name: body.full_name,
      email: body.email,
      phone_number: body.phone_number ?? null,
      full_phone: body.full_phone ?? null,
      number_of_participants: body.number_of_participants,
      join_menorah_lighting: body.join_menorah_lighting,
      join_chanukah_party: false, // Always false - party is full
      sponsorships: body.sponsorships,
      wants_to_donate: body.wants_to_donate,
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
      sendRegistrationEmail(
        body.full_name,
        body.email,
        body.join_menorah_lighting,
        body.number_of_participants
      ).catch(err => {
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
