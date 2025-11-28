import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { submitEntry } from "@/lib/submitEntry";
import { validateEmail } from "@/lib/emailValidation";
import { supabase } from "@/integrations/supabase/client";

const FORM_SUBMITTED_KEY = "menorah_form_submitted";

const RaffleForm = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    numberOfParticipants: "",
    joiningLocations: ['riverside'] as string[],
    selectedDonations: [] as string[],
    otherDonation: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string>("");
  const [phoneNumberError, setPhoneNumberError] = useState<string>("");

  // Check if form was already submitted and redirect
  useEffect(() => {
    if (localStorage.getItem(FORM_SUBMITTED_KEY)) {
      window.location.href = "https://jewishchagrinfalls.com/landing";
    }
  }, []);

  // Donation options
  const optionalDonationOptions = [
    { id: 'dreidel', label: 'DREIDEL', amount: 36 },
    { id: 'candle', label: 'CANDLE', amount: 54 },
    { id: 'menorah', label: 'MENORAH', amount: 180 },
    { id: 'flame', label: 'FLAME', amount: 360 },
  ];

  const eventSponsorOptions = [
    { id: 'nightly', label: 'ONE NIGHT OF NIGHTLY LIGHTINGS', amount: 540 },
    { id: 'coSponsor', label: 'MENORAH AT THE FALLS CO-SPONSOR', amount: 1800 },
  ];

  const allDonationOptions = [...optionalDonationOptions, ...eventSponsorOptions];

  // Calculate donation total from checkboxes
  const donationCheckboxTotal = formData.selectedDonations.reduce((total, donationId) => {
    const option = allDonationOptions.find((opt) => opt.id === donationId);
    return total + (option?.amount || 0);
  }, 0);

  // Parse other donation amount
  const otherDonationAmount = parseFloat(formData.otherDonation) || 0;

  // Total charge = donations + other donation
  const totalCharge = donationCheckboxTotal + otherDonationAmount;

  // Handle donation checkbox change
  const handleDonationChange = (donationId: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        selectedDonations: [...formData.selectedDonations, donationId],
      });
    } else {
      const newDonations = formData.selectedDonations.filter((id) => id !== donationId);
      setFormData({
        ...formData,
        selectedDonations: newDonations,
      });
    }
  };

  // Handle other donation input
  const handleOtherDonationChange = (value: string) => {
    // Allow only numbers and one decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
    // Limit to 2 decimal places
    const decimalParts = formatted.split('.');
    const final = decimalParts[1]?.length > 2 
      ? decimalParts[0] + '.' + decimalParts[1].slice(0, 2)
      : formatted;
    setFormData({ ...formData, otherDonation: final });
  };

  // Handle email validation
  const handleEmailChange = (email: string) => {
    setFormData({ ...formData, email });
    
    if (email.trim()) {
      const validation = validateEmail(email);
      if (!validation.valid) {
        setEmailError(validation.error || "");
      } else {
        setEmailError("");
      }
    } else {
      setEmailError("");
    }
  };

  // Handle phone number change (no formatting)
  const handlePhoneNumberChange = (value: string) => {
    setFormData({ ...formData, phoneNumber: value });
    setPhoneNumberError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.fullName.trim()) {
      toast.error("Please enter your full name");
      return;
    }

    if (!formData.email.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    // Email validation
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error);
      toast.error("Invalid email", {
        description: emailValidation.error,
      });
      return;
    }

    // Phone validation (optional but if provided, should have some content)
    if (formData.phoneNumber && formData.phoneNumber.trim().length < 6) {
      setPhoneNumberError("Please enter a valid phone number");
      toast.error("Invalid Phone Number", {
        description: "Please enter a valid phone number",
      });
      return;
    }

    // Validate number of participants
    if (!formData.numberOfParticipants) {
      toast.error("Please select number of participants");
      return;
    }

    // Validate joining locations
    if (formData.joiningLocations.length === 0) {
      toast.error("Please select at least one location you'll be joining");
      return;
    }

    // Set submitting state
    setIsSubmitting(true);

    try {
      // Check if user has donations (wants to donate)
      const hasDonations = formData.selectedDonations.length > 0 || otherDonationAmount > 0;
      
      if (hasDonations) {
        // STRIPE PAYMENT FLOW
        // First, save form submission to get an ID
        const response = await submitEntry({
          fullName: formData.fullName,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          numberOfParticipants: formData.numberOfParticipants,
          joiningLocations: formData.joiningLocations,
          selectedDonations: formData.selectedDonations,
          otherDonation: formData.otherDonation,
        });

        if (!response.success || !response.entryId) {
          toast.error("Submission failed", {
            description: response.error || "Please try again.",
          });
          return;
        }

        // Calculate total amount
        const totalAmount = totalCharge;

        // Create Stripe checkout session
        const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
          "create-checkout-session",
          {
            body: {
              formSubmissionId: response.entryId,
              amount: totalAmount,
              email: formData.email,
              fullName: formData.fullName,
            },
          }
        );

        if (checkoutError || !checkoutData?.url) {
          console.error("Checkout error:", checkoutError);
          toast.error("Payment setup failed", {
            description: "Unable to create payment session. Please try again.",
          });
          return;
        }

        // Mark form as submitted before redirecting to Stripe
        localStorage.setItem(FORM_SUBMITTED_KEY, "true");
        
        // Redirect to Stripe checkout
        window.location.href = checkoutData.url;
      } else {
        // DIRECT SUBMISSION (NO PAYMENT)
        const response = await submitEntry({
          fullName: formData.fullName,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          numberOfParticipants: formData.numberOfParticipants,
          joiningLocations: formData.joiningLocations,
          selectedDonations: formData.selectedDonations,
          otherDonation: formData.otherDonation,
        });

        if (response.success) {
          // Mark form as submitted and redirect to external thank-you page
          localStorage.setItem(FORM_SUBMITTED_KEY, "true");
          window.location.href = "https://jewishchagrinfalls.com/landing";
        } else {
          toast.error("Submission failed", {
            description: response.error || "Please try again.",
          });
        }
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Submission failed", {
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 md:space-y-8 w-full form-mobile">
      <div className="space-y-4 md:space-y-6">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-foreground font-medium text-base">
            Full Name <span className="text-gold">*</span>
          </Label>
          <Input
            id="fullName"
            placeholder="Enter your full name"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            required
            className="bg-input/80 backdrop-blur-sm border-border/60 text-foreground placeholder:text-foreground/50 focus:border-gold focus:ring-2 focus:ring-gold/40 transition-all duration-300 hover:border-gold/60 hover:shadow-[0_0_15px_rgba(255,215,0,0.2)]"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground font-medium text-base">
            Email Address <span className="text-gold">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="your.email@example.com"
            value={formData.email}
            onChange={(e) => handleEmailChange(e.target.value)}
            required
            className={`bg-input/80 backdrop-blur-sm border-border/60 text-foreground placeholder:text-foreground/50 focus:border-gold focus:ring-2 focus:ring-gold/40 transition-all duration-300 hover:border-gold/60 hover:shadow-[0_0_15px_rgba(255,215,0,0.2)] ${
              emailError ? "border-red-500 focus:border-red-500 focus:ring-red-500/40" : ""
            }`}
          />
          {emailError && (
            <p className="text-sm text-red-500 mt-1">{emailError}</p>
          )}
        </div>

        {/* Phone Number */}
        <div className="space-y-2">
          <Label htmlFor="phoneNumber" className="text-foreground font-medium text-base">
            Phone Number <span className="text-gold">*</span>
          </Label>
          <Input
            id="phoneNumber"
            type="tel"
            placeholder="Enter your phone number"
            value={formData.phoneNumber}
            onChange={(e) => handlePhoneNumberChange(e.target.value)}
            required
            className={`bg-input/80 backdrop-blur-sm border-border/60 text-foreground placeholder:text-foreground/50 focus:border-gold focus:ring-2 focus:ring-gold/40 transition-all duration-300 hover:border-gold/60 hover:shadow-[0_0_15px_rgba(255,215,0,0.2)] ${
              phoneNumberError ? "border-red-500 focus:border-red-500 focus:ring-red-500/40" : ""
            }`}
          />
          {phoneNumberError && (
            <p className="text-sm text-red-500 mt-1">{phoneNumberError}</p>
          )}
        </div>

        {/* Number of Participants Section */}
        <div className="space-y-2">
          <Label htmlFor="numberOfParticipants" className="text-foreground font-medium text-base">
            Number of Participants <span className="text-gold">*</span>
          </Label>
          <Select
            value={formData.numberOfParticipants}
            onValueChange={(value) => setFormData({ ...formData, numberOfParticipants: value })}
            required
          >
            <SelectTrigger
              id="numberOfParticipants"
              className="bg-input/80 backdrop-blur-sm border-border/60 text-foreground focus:border-gold focus:ring-2 focus:ring-gold/40 transition-all duration-300 hover:border-gold/60 hover:shadow-[0_0_15px_rgba(255,215,0,0.2)]"
            >
              <SelectValue placeholder="– select Number of participants –" className="text-foreground/50" />
            </SelectTrigger>
            <SelectContent className="bg-background/95 backdrop-blur-sm border-border/60 z-50">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Where Will You Be Joining */}
        <div className="space-y-3">
          <Label className="text-foreground font-medium text-base">
            Where will you be joining? <span className="text-gold">*</span>
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-3">
            {/* Menorah Lighting Checkbox */}
            <Label 
              htmlFor="location-riverside" 
              className={`flex items-center gap-2 md:gap-3 min-h-[36px] md:min-h-[44px] group px-2 py-2 md:px-3 md:py-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                formData.joiningLocations.includes('riverside') 
                  ? 'border-gold bg-gold/10' 
                  : 'border-gold/30 hover:border-gold/60 hover:bg-gold/5'
              }`}
            >
              <Checkbox
                id="location-riverside"
                checked={formData.joiningLocations.includes('riverside')}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setFormData({ ...formData, joiningLocations: [...formData.joiningLocations, 'riverside'] });
                  } else {
                    setFormData({ ...formData, joiningLocations: formData.joiningLocations.filter(l => l !== 'riverside') });
                  }
                }}
                className="border-gold/60 data-[state=checked]:bg-gold data-[state=checked]:border-gold ring-offset-background focus-visible:ring-2 focus-visible:ring-gold/40"
              />
              <span className={`text-xs md:text-base font-normal transition-colors duration-200 leading-snug ${
                formData.joiningLocations.includes('riverside') ? 'text-gold' : 'text-foreground/90 group-hover:text-gold'
              }`}>
                Menorah lighting at Riverside Park
              </span>
            </Label>
            
            {/* Chanukah Party Checkbox */}
            <Label 
              htmlFor="location-chabad" 
              className={`flex items-center gap-2 md:gap-3 min-h-[36px] md:min-h-[44px] group px-2 py-2 md:px-3 md:py-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                formData.joiningLocations.includes('chabad') 
                  ? 'border-gold bg-gold/10' 
                  : 'border-gold/30 hover:border-gold/60 hover:bg-gold/5'
              }`}
            >
              <Checkbox
                id="location-chabad"
                checked={formData.joiningLocations.includes('chabad')}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setFormData({ ...formData, joiningLocations: [...formData.joiningLocations, 'chabad'] });
                  } else {
                    setFormData({ ...formData, joiningLocations: formData.joiningLocations.filter(l => l !== 'chabad') });
                  }
                }}
                className="border-gold/60 data-[state=checked]:bg-gold data-[state=checked]:border-gold ring-offset-background focus-visible:ring-2 focus-visible:ring-gold/40"
              />
              <span className={`text-xs md:text-base font-normal transition-colors duration-200 leading-snug ${
                formData.joiningLocations.includes('chabad') ? 'text-gold' : 'text-foreground/90 group-hover:text-gold'
              }`}>
                Chanukah Party at Chabad at the Falls
              </span>
            </Label>
          </div>
          <p className="text-sm text-foreground/60 mt-2">
            Select one or both. Party follows immediately after lighting.
          </p>
        </div>

        {/* Donate Section */}
        <div 
          id="donate-section" 
          className="space-y-6" 
          role="region" 
          aria-labelledby="donate-label"
        >
            {/* Section Header: Donate */}
            <div className="space-y-2">
              <h3 id="donate-label" className="text-gold font-bold text-xl md:text-2xl tracking-wide">
                Donate
              </h3>
              <div className="h-px w-full bg-gradient-to-r from-gold/60 via-gold/40 to-transparent" />
            </div>

            {/* Subsection: Optional Donation */}
            <div className="space-y-2 md:space-y-3">
              <h4 className="text-foreground/80 font-semibold text-sm tracking-widest uppercase">
                Optional Donation
              </h4>
              <div className="space-y-1.5 md:space-y-2">
                {optionalDonationOptions.map((option) => {
                  const isChecked = formData.selectedDonations.includes(option.id);
                  return (
                    <Label
                      key={option.id}
                      htmlFor={`donation-${option.id}`}
                      className={`flex items-center gap-2 md:gap-3 min-h-[36px] md:min-h-[48px] px-2 py-1.5 md:px-4 md:py-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                        isChecked
                          ? "border-gold bg-gold/15 shadow-[0_0_15px_rgba(255,215,0,0.15)]"
                          : "border-gold/30 bg-gold/5 hover:border-gold/60 hover:bg-gold/10"
                      }`}
                    >
                      <Checkbox
                        id={`donation-${option.id}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          handleDonationChange(option.id, checked as boolean);
                        }}
                        className="border-gold/60 data-[state=checked]:bg-gold data-[state=checked]:border-gold ring-offset-background focus-visible:ring-2 focus-visible:ring-gold/40 shrink-0"
                        aria-label={`${option.label} - $${option.amount}.00`}
                      />
                      <span className={`flex-1 flex items-center justify-between text-xs md:text-base ${isChecked ? "text-gold font-medium" : "text-foreground/90"}`}>
                        <span>{option.label}</span>
                        <span className={`font-semibold ${isChecked ? "text-gold" : "text-gold/80"}`}>
                          ${option.amount.toFixed(2)}
                        </span>
                      </span>
                    </Label>
                  );
                })}
              </div>
            </div>

            {/* Subsection: Event Sponsor */}
            <div className="space-y-2 md:space-y-3">
              <h4 className="text-foreground/80 font-semibold text-sm tracking-widest uppercase">
                Event Sponsor
              </h4>
              <div className="space-y-1.5 md:space-y-2">
                {eventSponsorOptions.map((option) => {
                  const isChecked = formData.selectedDonations.includes(option.id);
                  return (
                    <Label
                      key={option.id}
                      htmlFor={`donation-${option.id}`}
                      className={`flex items-center gap-2 md:gap-3 min-h-[36px] md:min-h-[48px] px-2 py-1.5 md:px-4 md:py-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                        isChecked
                          ? "border-gold bg-gold/15 shadow-[0_0_15px_rgba(255,215,0,0.15)]"
                          : "border-gold/30 bg-gold/5 hover:border-gold/60 hover:bg-gold/10"
                      }`}
                    >
                      <Checkbox
                        id={`donation-${option.id}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          handleDonationChange(option.id, checked as boolean);
                        }}
                        className="border-gold/60 data-[state=checked]:bg-gold data-[state=checked]:border-gold ring-offset-background focus-visible:ring-2 focus-visible:ring-gold/40 shrink-0"
                        aria-label={`${option.label} - $${option.amount}.00`}
                      />
                      <span className={`flex-1 flex items-center justify-between text-xs md:text-base ${isChecked ? "text-gold font-medium" : "text-foreground/90"}`}>
                        <span>{option.label}</span>
                        <span className={`font-semibold ${isChecked ? "text-gold" : "text-gold/80"}`}>
                          ${option.amount.toFixed(2)}
                        </span>
                      </span>
                    </Label>
                  );
                })}
              </div>
            </div>

            {/* Subsection: Other Donation */}
            <div className="space-y-3">
              <h4 className="text-foreground/80 font-semibold text-sm tracking-widest uppercase">
                Other Donation
              </h4>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-300 font-semibold text-lg pointer-events-none z-10">
                  $
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Enter other amount"
                  value={formData.otherDonation}
                  onChange={(e) => handleOtherDonationChange(e.target.value)}
                  className="pl-8 bg-input/80 backdrop-blur-sm border-border/60 text-foreground placeholder:text-foreground/50 focus:border-gold focus:ring-2 focus:ring-gold/40 transition-all duration-300 hover:border-gold/60 hover:shadow-[0_0_15px_rgba(255,215,0,0.2)]"
                  aria-label="Other donation amount"
                />
              </div>
            </div>

            {/* Total Charge Row */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-gold/30">
              <span className="text-foreground font-semibold text-base md:text-lg">Total Charge</span>
              <span className="text-gold font-bold text-lg md:text-xl">
                ${totalCharge.toFixed(2)} USD
              </span>
            </div>
              
            {/* Hidden inputs for form submission */}
            <input
              type="hidden"
              name="selected_donations"
              value={formData.selectedDonations
                .map((id) => allDonationOptions.find((opt) => opt.id === id)?.label)
                .filter(Boolean)
                .join(", ")}
            />
            <input
              type="hidden"
              name="donation_total_usd"
              value={totalCharge.toFixed(2)}
            />
          </div>

        {/* Submit */}
        <div className="pt-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full relative overflow-hidden bg-gradient-to-r from-gold via-amber to-gold text-background font-semibold text-lg py-6 rounded-xl shadow-lg hover:shadow-[0_0_40px_rgba(255,215,0,0.6)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border border-gold/30 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <span className="relative z-10">
              {isSubmitting 
                ? "Processing..." 
                : (formData.selectedDonations.length > 0 || otherDonationAmount > 0) 
                  ? "Pay Now" 
                  : "Submit Entry"
              }
            </span>
            {/* Ripple effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          </Button>
        </div>

        {/* Chanukah Flyer Image */}
        <div className="pt-6 mt-4 flex justify-center">
          <img
            src="/chanukah-flyer.jpg"
            alt="Chanukah at the Falls Event Flyer"
            className="w-full max-w-3xl mx-auto rounded-3xl shadow-lg shadow-gold/20"
          />
        </div>

        {/* Nightly Menorah Lighting Section */}
        <div className="pt-8 mt-6 space-y-4 text-center">
          <h3 className="text-gold font-bold text-xl md:text-2xl tracking-wide drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]">
            NIGHTLY MENORAH LIGHTING
          </h3>
          <p className="text-foreground/90 text-base md:text-lg leading-relaxed">
            JOIN A MENORAH LIGHTING CEREMONY EACH NIGHT OF CHANUKAH AT 7PM AT THE
            BANDSTAND AT TRIANGLE PARK. MUSIC AND CHANUKAH TREATS SERVED.
          </p>
          <p className="text-foreground/70 text-sm md:text-base">
            SEE FULL SCHEDULE BELOW.
          </p>
        </div>

        {/* Bell St Menorah Schedule Image */}
        <img
          src="/bell-st-menorah-schedule.jpg"
          alt="Bell St Menorah Schedule"
          className="w-full max-w-3xl mx-auto rounded-3xl shadow-lg my-10"
        />
      </div>
    </form>
  );
};

export default RaffleForm;
