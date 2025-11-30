import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Test email configuration for Menorah at the Falls
    const testEmail = "rabbi@jewishchagrinfalls.com";
    const fullName = "Test User";

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) {
      throw new Error("Missing BREVO_API_KEY");
    }

    const htmlContent = `
<p>Dear ${fullName},</p>

<p>Thank you for registering for <strong>Menorah at the Falls</strong>. See you on the first night of Chanukah, Sunday, December 14 at 5pm!</p>

<p><strong>The event begins at Riverside Park.</strong> Enjoy a fire show and hot drinks at 5pm, followed by the Menorah lighting and a Gelt Drop from a fire truck at 5:30pm.</p>

<p>To donate to this event and year-round Jewish programming, please visit <a href="https://jewishchagrinfalls.com/donate">jewishchagrinfalls.com/donate</a>.</p>

<p><strong>After the lighting, the celebration continues up the street at Chabad at the Falls,</strong> 100 N Main Street, Suite 100. Join a Chanukah party with latkes, donuts, children's activities, and fun for the whole family.</p>

<hr>

<p>You can also join us at the <strong>Triangle bandstand each night of Chanukah for a Menorah lighting ceremony,</strong> December 15 through December 21 at 7pm. Full schedule at <a href="https://jewishchagrinfalls.com/chanukah">jewishchagrinfalls.com/chanukah</a>.</p>

<p><em>This is a test email.</em></p>
`;

    const payload = {
      sender: { name: "Menorah at the Falls", email: "Rabbi@jewishchagrinfalls.com" },
      to: [{ email: testEmail, name: fullName }],
      cc: [
        { email: "Rabbi@jewishchagrinfalls.com", name: "Rabbi" },
        { email: "simi@jewishchagrinfalls.com", name: "Simi" }
      ],
      subject: "TEST: You're Registered for Menorah at the Falls!",
      htmlContent,
    };

    console.log("[email] Attempting to send test email...");

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
    
    console.log(`[email] Sent successfully to ${testEmail}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error(`[email] Error: ${err}`);
    return new Response(JSON.stringify({ error: "Email sending failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
