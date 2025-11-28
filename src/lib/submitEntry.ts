import { supabase } from "@/integrations/supabase/client";
import { validateEmail } from "./emailValidation";

export interface MenorahEntryData {
  fullName: string;
  email: string;
  phoneNumber: string;
  numberOfParticipants: string;
  joiningLocations: string[];
  selectedDonations: string[];
  otherDonation: string;
}

export interface MenorahEntryResponse {
  success: boolean;
  entryId?: string;
  error?: string;
  needsVerification?: boolean;
}

/**
 * Generates a secure random verification token
 */
function generateVerificationToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Submits a form entry to the database
 * @param formData - The form data from the RaffleForm component
 * @returns Promise with success status and entry ID or error message
 */
export async function submitEntry(
  formData: MenorahEntryData
): Promise<MenorahEntryResponse> {
  try {
    // Validation
    if (!formData.fullName || !formData.fullName.trim()) {
      return {
        success: false,
        error: "Full name is required",
      };
    }

    if (!formData.email || !formData.email.trim()) {
      return {
        success: false,
        error: "Email address is required",
      };
    }

    // Enhanced email validation with disposable domain checking
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.valid) {
      return {
        success: false,
        error: emailValidation.error,
      };
    }

    if (!formData.joiningLocations || formData.joiningLocations.length === 0) {
      return {
        success: false,
        error: "Please select at least one location you'll be joining",
      };
    }

    // Parse other donation amount
    const otherDonationAmount = parseFloat(formData.otherDonation) || 0;

    const wantsToDonate = formData.selectedDonations.length > 0 || otherDonationAmount > 0;

    // Generate verification token
    const verificationToken = generateVerificationToken();

    // Phone number (store as-is, no formatting required)
    const phoneNumber = formData.phoneNumber ? formData.phoneNumber.trim() : null;

    // Convert joining locations to booleans
    const joinMenorahLighting = formData.joiningLocations.includes('riverside');
    const joinChanukahParty = formData.joiningLocations.includes('chabad');

    // Map selected donation IDs to their labels for storage
    const donationOptions = [
      { id: 'dreidel', label: 'DREIDEL' },
      { id: 'candle', label: 'CANDLE' },
      { id: 'menorah', label: 'MENORAH' },
      { id: 'flame', label: 'FLAME' },
      { id: 'nightly', label: 'ONE NIGHT OF NIGHTLY LIGHTINGS' },
      { id: 'coSponsor', label: 'MENORAH AT THE FALLS CO-SPONSOR' },
    ];
    
    const sponsorshipLabels = formData.selectedDonations
      .map(id => donationOptions.find(opt => opt.id === id)?.label)
      .filter(Boolean) as string[];

    // Prepare the database entry
    const entry = {
      full_name: formData.fullName.trim(),
      email: formData.email.trim().toLowerCase(),
      phone_number: phoneNumber,
      full_phone: phoneNumber,
      number_of_participants: parseInt(formData.numberOfParticipants, 10) || 1,
      join_menorah_lighting: joinMenorahLighting,
      join_chanukah_party: joinChanukahParty,
      sponsorships: sponsorshipLabels,
      other_donation: otherDonationAmount > 0 ? otherDonationAmount : null,
      wants_to_donate: wantsToDonate,
      verification_token: verificationToken,
      verification_sent_at: new Date().toISOString(),
    };

    // Insert via Edge Function to bypass RLS
    const { data: insertData, error: insertError } = await supabase.functions.invoke('submit-form-entry', {
      body: entry,
    });

    if (insertError || !insertData?.id) {
      console.error("Error inserting form submission via function:", insertError);
      return {
        success: false,
        error: "Failed to submit your entry. Please try again.",
      };
    }

    const data = { id: insertData.id as string };


    // Send verification email
    try {
      const { error: emailError } = await supabase.functions.invoke('send-verification-email', {
        body: {
          email: formData.email.trim().toLowerCase(),
          name: formData.fullName.trim(),
          token: verificationToken,
        },
      });

      if (emailError) {
        console.error("Error sending verification email:", emailError);
      }
    } catch (emailError) {
      console.error("Error invoking send-verification-email function:", emailError);
    }

    console.log("Created form_submissions row with id:", data.id);

    return {
      success: true,
      entryId: data.id,
      needsVerification: wantsToDonate,
    };
  } catch (error) {
    console.error("Unexpected error submitting entry:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
