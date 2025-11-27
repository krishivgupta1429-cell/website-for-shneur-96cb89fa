import { useState } from "react";
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

const RaffleForm = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    areaCode: "+1",
    phoneNumber: "",
    numberOfParticipants: "",
    joiningLocations: [] as string[],
    selectedDonations: [] as string[],
    otherDonation: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string>("");
  const [areaCodeError, setAreaCodeError] = useState<string>("");
  const [phoneNumberError, setPhoneNumberError] = useState<string>("");

  // Phone format mapping for different countries
  const phoneFormats: Record<string, { placeholder: string; digits: number }> = {
    '+1': { placeholder: '(123) 456-7890', digits: 10 },    // US/Canada
    '+44': { placeholder: '7123 456789', digits: 10 },    // UK
    '+91': { placeholder: '98765 43210', digits: 10 },    // India
    '+61': { placeholder: '412 345 678', digits: 9 },     // Australia
  };

  // Get current format based on area code
  const currentFormat = phoneFormats[formData.areaCode] || { placeholder: 'Phone number', digits: 15 };

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

  // Handle area code validation
  const handleAreaCodeChange = (value: string) => {
    // Only allow + at the beginning and digits, max 4 characters
    const cleaned = value.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+') || cleaned === '') {
      const areaCode = cleaned.slice(0, 4);
      setFormData({ ...formData, areaCode });
      
      if (areaCode && areaCode.length < 2) {
        setAreaCodeError("Area code must be at least 2 characters");
      } else if (areaCode && !areaCode.startsWith('+')) {
        setAreaCodeError("Area code must start with +");
      } else {
        setAreaCodeError("");
      }
      
      // Clear phone number error when area code changes (format may have changed)
      if (phoneNumberError) {
        setPhoneNumberError("");
      }
    }
  };

  // Handle phone number validation with US formatting
  const handlePhoneNumberChange = (value: string) => {
    // Strip all non-digit characters
    const digitsOnly = value.replace(/\D/g, '');
    
    // For US/Canada (+1), limit to exactly 10 digits and format as (XXX) XXX-XXXX
    if (formData.areaCode === '+1') {
      // Limit to 10 digits max
      const limited = digitsOnly.slice(0, 10);
      
      let formatted = limited;
      const len = limited.length;
      
      if (len <= 2) {
        // 1-2 digits: show as-is (e.g., "4", "43")
        formatted = limited;
      } else if (len === 3) {
        // 3 digits: add parentheses (e.g., "(434)")
        formatted = `(${limited})`;
      } else if (len <= 6) {
        // 4-6 digits: (XXX) X... (e.g., "(434) 3", "(434) 334")
        formatted = `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
      } else {
        // 7-10 digits: (XXX) XXX-X... (e.g., "(434) 334-3", "(434) 334-3456")
        formatted = `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
      }
      
      setFormData({ ...formData, phoneNumber: formatted });
      setPhoneNumberError("");
    } else {
      // For other countries, enforce max length based on current format
      if (digitsOnly.length <= currentFormat.digits) {
        setFormData({ ...formData, phoneNumber: digitsOnly });
        setPhoneNumberError("");
      }
    }
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

    // Phone validation with format-specific rules
    if (formData.phoneNumber) {
      const cleanedNumber = formData.phoneNumber.replace(/\D/g, "");
      
      // Special validation for US numbers
      if (formData.areaCode === '+1') {
        if (cleanedNumber.length !== 10) {
          setPhoneNumberError("Please enter a valid 10-digit US phone number.");
          toast.error("Invalid Phone Number", {
            description: "Please enter a valid 10-digit US phone number.",
          });
          return;
        }
      } else {
        // Validate based on current format for other countries
        if (cleanedNumber.length < 6) {
          setPhoneNumberError("Phone number must be at least 6 digits");
          toast.error("Invalid Phone Number", {
            description: "Phone number must be at least 6 digits",
          });
          return;
        }
        
        if (cleanedNumber.length > currentFormat.digits) {
          setPhoneNumberError(`Phone number must be at most ${currentFormat.digits} digits for ${formData.areaCode}`);
          toast.error("Invalid Phone Number", {
            description: `Phone number must be at most ${currentFormat.digits} digits for ${formData.areaCode}`,
          });
          return;
        }
      }
    }

    // Validate area code if provided
    if (formData.areaCode && !formData.areaCode.startsWith('+')) {
      setAreaCodeError("Area code must start with +");
      toast.error("Invalid Area Code", {
        description: "Area code must start with + (e.g., +1, +44, +91)",
      });
      return;
    }

    // If both area code and phone number are provided together or both empty, that's ok
    // But if only one is provided, show error
    if ((formData.areaCode && !formData.phoneNumber) || (!formData.areaCode && formData.phoneNumber)) {
      if (!formData.phoneNumber) {
        setPhoneNumberError("Please enter a phone number");
        toast.error("Incomplete Phone Number", {
          description: "Please enter both area code and phone number",
        });
      }
      if (!formData.areaCode) {
        setAreaCodeError("Please enter an area code");
        toast.error("Incomplete Phone Number", {
          description: "Please enter both area code and phone number",
        });
      }
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
          areaCode: formData.areaCode,
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

        // Redirect to Stripe checkout
        window.location.href = checkoutData.url;
      } else {
        // DIRECT SUBMISSION (NO PAYMENT)
        const response = await submitEntry({
          fullName: formData.fullName,
          email: formData.email,
          areaCode: formData.areaCode,
          phoneNumber: formData.phoneNumber,
          numberOfParticipants: formData.numberOfParticipants,
          joiningLocations: formData.joiningLocations,
          selectedDonations: formData.selectedDonations,
          otherDonation: formData.otherDonation,
        });

        if (response.success) {
          toast.success("Success! ✨", {
            description: "Thank you for being part of our community celebration.",
          });

          // Reset form
          setFormData({
            fullName: "",
            email: "",
            areaCode: "+1",
            phoneNumber: "",
            numberOfParticipants: "",
            joiningLocations: [],
            selectedDonations: [],
            otherDonation: "",
          });
          setEmailError("");
          setAreaCodeError("");
          setPhoneNumberError("");
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

        {/* Phone - Area Code and Number */}
        <div className="space-y-2">
          <Label className="text-foreground font-medium text-base">
            Phone Number <span className="text-gold">*</span>
          </Label>
          <div className="flex flex-row gap-3">
            {/* Area Code */}
            <div className="w-24 flex-shrink-0">
              <Label htmlFor="areaCode" className="text-xs text-foreground/70 mb-1 block">
                Country Code
              </Label>
              <Input
                id="areaCode"
                type="text"
                placeholder="+1"
                value={formData.areaCode}
                onChange={(e) => handleAreaCodeChange(e.target.value)}
                required
                maxLength={4}
                className={`bg-input/80 backdrop-blur-sm border-border/60 text-foreground placeholder:text-foreground/50 focus:border-gold focus:ring-2 focus:ring-gold/40 transition-all duration-300 hover:border-gold/60 hover:shadow-[0_0_15px_rgba(255,215,0,0.2)] ${
                  areaCodeError ? "border-red-500 focus:border-red-500 focus:ring-red-500/40" : ""
                }`}
              />
              {areaCodeError && (
                <p className="text-xs text-red-500 mt-1">{areaCodeError}</p>
              )}
            </div>
            {/* Phone Number */}
            <div className="flex-1">
              <Label htmlFor="phoneNumber" className="text-xs text-foreground/70 mb-1 block">
                Number
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder={currentFormat.placeholder}
                value={formData.phoneNumber}
                onChange={(e) => handlePhoneNumberChange(e.target.value)}
                required
                inputMode="numeric"
                className={`bg-input/80 backdrop-blur-sm border-border/60 text-foreground placeholder:text-foreground/50 focus:border-gold focus:ring-2 focus:ring-gold/40 transition-all duration-300 hover:border-gold/60 hover:shadow-[0_0_15px_rgba(255,215,0,0.2)] ${
                  phoneNumberError ? "border-red-500 focus:border-red-500 focus:ring-red-500/40" : ""
                }`}
              />
              {phoneNumberError && (
                <p className="text-xs text-red-500 mt-1">{phoneNumberError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="flex items-center justify-center py-4">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          <div className="mx-4 text-2xl animate-candle-flicker">✨</div>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
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

        {/* Separator */}
        <div className="flex items-center justify-center py-4">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          <div className="mx-4 text-2xl animate-candle-flicker">✨</div>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        </div>

        {/* Where Will You Be Joining */}
        <div className="space-y-3">
          <Label className="text-foreground font-medium text-base">
            Where will you be joining? <span className="text-gold">*</span>
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Menorah Lighting Checkbox */}
            <Label 
              htmlFor="location-riverside" 
              className={`flex items-center gap-3 min-h-[44px] group px-3 py-3 rounded-lg border transition-all duration-200 cursor-pointer ${
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
              <span className={`text-base font-normal transition-colors duration-200 leading-relaxed ${
                formData.joiningLocations.includes('riverside') ? 'text-gold' : 'text-foreground/90 group-hover:text-gold'
              }`}>
                Menorah lighting at Riverside Park
              </span>
            </Label>
            
            {/* Chanukah Party Checkbox */}
            <Label 
              htmlFor="location-chabad" 
              className={`flex items-center gap-3 min-h-[44px] group px-3 py-3 rounded-lg border transition-all duration-200 cursor-pointer ${
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
              <span className={`text-base font-normal transition-colors duration-200 leading-relaxed ${
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

        {/* Separator */}
        <div className="flex items-center justify-center py-4">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          <div className="mx-4 text-2xl animate-candle-flicker">✨</div>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
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
            <div className="space-y-3">
              <h4 className="text-foreground/80 font-semibold text-sm tracking-widest uppercase">
                Optional Donation
              </h4>
              <div className="space-y-2">
                {optionalDonationOptions.map((option) => {
                  const isChecked = formData.selectedDonations.includes(option.id);
                  return (
                    <Label
                      key={option.id}
                      htmlFor={`donation-${option.id}`}
                      className={`flex items-center gap-3 min-h-[48px] px-4 py-3 rounded-lg border cursor-pointer transition-all duration-200 ${
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
                      <span className={`flex-1 flex items-center justify-between ${isChecked ? "text-gold font-medium" : "text-foreground/90"}`}>
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
            <div className="space-y-3">
              <h4 className="text-foreground/80 font-semibold text-sm tracking-widest uppercase">
                Event Sponsor
              </h4>
              <div className="space-y-2">
                {eventSponsorOptions.map((option) => {
                  const isChecked = formData.selectedDonations.includes(option.id);
                  return (
                    <Label
                      key={option.id}
                      htmlFor={`donation-${option.id}`}
                      className={`flex items-center gap-3 min-h-[48px] px-4 py-3 rounded-lg border cursor-pointer transition-all duration-200 ${
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
                      <span className={`flex-1 flex items-center justify-between ${isChecked ? "text-gold font-medium" : "text-foreground/90"}`}>
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
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gold font-semibold text-lg pointer-events-none">
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

        {/* Chanukah Flyer Image */}
        <div className="pt-6 mt-4">
          <img
            src="/chanukah flyer.jpg"
            alt="Chanukah at the Falls Event Flyer"
            className="w-full rounded-2xl shadow-[0_0_30px_rgba(255,215,0,0.2)] object-contain"
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
        <div className="pt-6 mt-4">
          <img
            src="/bell st menorah schedule.jpg"
            alt="Nightly Menorah Lighting Schedule"
            className="w-full rounded-2xl shadow-[0_0_30px_rgba(255,215,0,0.2)] object-contain"
          />
        </div>
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
    </form>
  );
};

export default RaffleForm;
