import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, ArrowRight, ArrowLeft, Shield, Clock, Phone, Globe, User, Building, Calendar, MessageSquare, FileText, CreditCard } from "lucide-react";
import { LegalAgreement } from "@/components/LegalAgreement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// --- Types & Data ---

type QuestionType = "text" | "email" | "tel" | "number" | "textarea" | "select" | "radio" | "checkbox" | "multi-input" | "info" | "legal_agreement";

interface Question {
  id: string;
  section: string;
  title: string;
  description?: string;
  type: QuestionType;
  options?: { label: string; value: string; hasOtherInput?: boolean }[];
  placeholder?: string;
  required?: boolean;
  subFields?: { id: string; label: string; type: string; placeholder?: string; width?: "full" | "half" }[];
}

const SECTIONS = [
  { id: "business", title: "Business Info", icon: Building },
  { id: "operations", title: "Operations", icon: Clock },
  { id: "voice", title: "Voice Identity", icon: MessageSquare },
  { id: "goals", title: "Call Goals", icon: Check },
  { id: "tech", title: "Systems & Tools", icon: Globe },
  { id: "legal", title: "Legal & Terms", icon: Shield },
];

const QUESTIONS: Question[] = [
  // Section 1: Business Info
  {
    id: "company_name",
    section: "business",
    title: "Company Identity",
    description: "Let's start with the basics. What is your business name? (Note: You may skip fields if the information is readily available on your website, but please include anything you're not 100% confident is clearly listed there.)",
    type: "text",
    placeholder: "Olexum Group LLC"
  },
  {
    id: "industry",
    section: "business",
    title: "Industry & Vertical",
    description: "Which industry do you operate in?",
    type: "select",
    options: [
      { label: "Med Spa / Aesthetics", value: "medspa" },
      { label: "Dental Practice", value: "dental" },
      { label: "HVAC / Plumbing", value: "hvac" },
      { label: "Real Estate", value: "real_estate" },
      { label: "Law Firm", value: "legal" },
      { label: "Chiropractic", value: "chiro" },
      { label: "Solar", value: "solar" },
      { label: "Other", value: "other", hasOtherInput: true }
    ]
  },
  {
    id: "company_size",
    section: "business",
    title: "Company Size",
    description: "Help us understand your scale.",
    type: "multi-input",
    subFields: [
      { id: "employees", label: "Number of Employees", type: "number", placeholder: "10", width: "half" },
      { id: "locations", label: "Number of Locations", type: "number", placeholder: "1", width: "half" }
    ]
  },
  {
    id: "avg_client_value",
    section: "business",
    title: "Client Value",
    description: "What is the average expenditure per client? This helps us estimate your ROI.",
    type: "number",
    placeholder: "1500"
  },
  {
    id: "contact_info",
    section: "business",
    title: "Primary Contact",
    description: "Who should we contact regarding this implementation?",
    type: "multi-input",
    subFields: [
      { id: "name", label: "Full Name", type: "text", placeholder: "John Doe", width: "full" },
      { id: "email", label: "Email Address", type: "email", placeholder: "john@example.com", width: "half" },
      { id: "phone", label: "Phone Number", type: "tel", placeholder: "+1 (555) 000-0000", width: "half" },
      { id: "role", label: "Role/Title", type: "text", placeholder: "Owner / CEO", width: "full" }
    ]
  },
  {
    id: "website_url",
    section: "business",
    title: "Website",
    description: "Where can we learn more about your brand voice?",
    type: "text",
    placeholder: "https://example.com"
  },

  // Section 2: Operations
  {
    id: "timezone",
    section: "operations",
    title: "Time Zone",
    description: "Which time zone(s) do you operate in?",
    type: "select",
    options: [
      { label: "Eastern Time (ET)", value: "ET" },
      { label: "Central Time (CT)", value: "CT" },
      { label: "Mountain Time (MT)", value: "MT" },
      { label: "Pacific Time (PT)", value: "PT" },
      { label: "Other", value: "other", hasOtherInput: true }
    ]
  },
  {
    id: "hours",
    section: "operations",
    title: "Business Hours",
    description: "When are you open for business?",
    type: "textarea",
    placeholder: "Mon-Fri: 9am - 5pm\nSat: 10am - 2pm\nSun: Closed"
  },

  // Section 3: Voice Identity
  {
    id: "voice_gender",
    section: "voice",
    title: "Voice Preference",
    description: "What should your AI agent sound like?",
    type: "radio",
    options: [
      { label: "Female", value: "female" },
      { label: "Male", value: "male" }
    ]
  },
  {
    id: "voice_accent",
    section: "voice",
    title: "Accent & Language",
    description: "Any specific accent or language requirements?",
    type: "text",
    placeholder: "American English (Standard), British, Spanish, etc."
  },

  // Section 4: Call Goals
  {
    id: "call_goal",
    section: "goals",
    title: "Primary Objective",
    description: "What is the #1 goal for every call?",
    type: "select",
    options: [
      { label: "Qualify Lead", value: "qualify" },
      { label: "Book Appointment", value: "book" },
      { label: "Answer FAQs", value: "faq" },
      { label: "Transfer to Human", value: "transfer" },
      { label: "Other", value: "other", hasOtherInput: true }
    ]
  },
  {
    id: "info_collection",
    section: "goals",
    title: "Data Collection",
    description: "What info must be collected? (List in priority order)",
    type: "textarea",
    placeholder: "1. Name\n2. Phone Number\n3. Service Interest\n4. Budget..."
  },
  {
    id: "faqs",
    section: "goals",
    title: "Common FAQs",
    description: "What do callers ask most often? Provide answers.",
    type: "textarea",
    placeholder: "Q: How much does it cost?\nA: It depends on..."
  },

  // Section 5: Tech Stack
  {
    id: "calendar",
    section: "tech",
    title: "Calendar System",
    description: "Which calendar do you use for bookings?",
    type: "select",
    options: [
      { label: "Google Calendar", value: "google" },
      { label: "Outlook / Office 365", value: "outlook" },
      { label: "Calendly", value: "calendly" },
      { label: "GoHighLevel", value: "ghl" },
      { label: "Other", value: "other", hasOtherInput: true }
    ]
  },
  {
    id: "crm",
    section: "tech",
    title: "CRM Platform",
    description: "Where should leads be sent? (Optional)",
    type: "text",
    placeholder: "Enter your CRM name (if applicable)",
    required: false
  },
  {
    id: "meeting_types",
    section: "tech",
    title: "Meeting Types",
    description: "What types of appointments can be booked?",
    type: "textarea",
    placeholder: "Consultation (30 min), Demo (45 min), Service Call (1 hr)..."
  },
  {
    id: "booking_rules",
    section: "tech",
    title: "Booking Rules",
    description: "Any specific rules? (e.g., 24h notice, buffer time)",
    type: "textarea",
    placeholder: "No same-day bookings, 15 min buffer between calls..."
  },
  {
    id: "phone_provider",
    section: "tech",
    title: "Phone Provider",
    description: "Who is your current phone carrier?",
    type: "text",
    placeholder: "RingCentral, Twilio, Verizon, AT&T..."
  },
  {
    id: "forwarding",
    section: "tech",
    title: "Call Forwarding",
    description: "Which number(s) will forward calls to the AI?",
    type: "text",
    placeholder: "+1 (555) 123-4567"
  },

  // Section 6: Additional Info
  {
    id: "additional_info",
    section: "tech",
    title: "Additional Information",
    description: "Is there anything else we should know?",
    type: "textarea",
    placeholder: "Any specific requirements, context, or questions...",
    required: false
  },

  // Section 7: Legal & Terms
  {
    id: "terms_acceptance",
    section: "legal",
    title: "Terms of Service & Liability",
    description: "Please review and sign our standard AI Agency Terms and Liability Waiver.",
    type: "legal_agreement",
    required: true
  }
];

// --- Components ---

const CompletionScreen = ({ onProceed }: { onProceed: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center text-center p-8 max-w-2xl mx-auto"
  >
    <div className="w-24 h-24 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mb-8 glow-green">
      <Check className="w-12 h-12 text-green-500" />
    </div>
    <h2 className="text-4xl font-bold mb-4 tracking-tight">Data Collection Complete</h2>
    <p className="text-xl text-muted-foreground mb-8">
      Your onboarding data has been securely recorded. Please proceed to the final steps to activate your 16-day trial.
    </p>
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-md mb-8">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground font-mono">STATUS</span>
        <span className="text-sm text-green-500 font-mono flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          PROCESSING
        </span>
      </div>
      <div className="space-y-3">
        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-green-500"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-left font-mono">Syncing data...</p>
      </div>
    </div>
    <Button 
      className="bg-white text-black hover:bg-white/90 px-8 h-12 rounded-full font-medium text-lg"
      onClick={onProceed}
    >
      Proceed to Secure Setup
    </Button>
  </motion.div>
);

const ProgressBar = ({ current, total }: { current: number; total: number }) => {
  const progress = ((current + 1) / total) * 100;
  return (
    <div className="w-full bg-secondary/30 h-1 mt-8 mb-4 rounded-full overflow-hidden">
      <motion.div 
        className="h-full bg-primary glow-blue"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />
    </div>
  );
};

const SidebarItem = ({ section, isActive, isCompleted }: { section: typeof SECTIONS[0], isActive: boolean, isCompleted: boolean }) => {
  return (
    <div className={cn(
      "flex items-center gap-3 py-3 px-4 rounded-lg transition-all duration-300",
      isActive ? "bg-primary/10 border border-primary/20 text-primary" : "text-muted-foreground",
      isCompleted && !isActive ? "text-green-500" : ""
    )}>
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center border text-xs font-mono transition-colors",
        isActive ? "border-primary bg-primary/20 text-primary" : 
        isCompleted ? "border-green-500 bg-green-500/10 text-green-500" : "border-muted-foreground/30 bg-muted/10"
      )}>
        {isCompleted ? <Check className="w-4 h-4" /> : <section.icon className="w-4 h-4" />}
      </div>
      <span className="font-medium text-sm tracking-wide uppercase">{section.title}</span>
    </div>
  );
};

export default function OnboardingForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [direction, setDirection] = useState(0);

  const handleSubmission = async () => {
    setIsSubmitting(true);
    try {
      // Prepare payload with flattened signature data
      const payload = { ...formData };

      // Flatten signature data if present
      if (payload.terms_acceptance && typeof payload.terms_acceptance === 'object') {
        const signatureData = payload.terms_acceptance;
        payload.signature_name = signatureData.signedName;
        payload.signer_title = signatureData.signedTitle;
        payload.date_signed = signatureData.signedDate;
        payload.signer_email = signatureData.signedEmail;
        delete payload.terms_acceptance;
      }

      // Send data to onboarding API (creates GHL sub-account, applies snapshot, logs to Notion)
      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        console.error("Onboard API error:", body);
      }

      // Redirect to Setup Page (Calendar -> Stripe)
      window.location.href = "/setup";
    } catch (error) {
      console.error("Submission error:", error);
      // Fallback redirect even if API fails (prioritize payment flow)
      window.location.href = "/setup";
    }
  };

  const currentQuestion = QUESTIONS[currentStep];
  const currentSectionIndex = SECTIONS.findIndex(s => s.id === currentQuestion.section);
  
  const handleNext = () => {
    // Validation Logic
    if (currentQuestion.required) {
      const value = formData[currentQuestion.id];
      
      // Basic text/select validation
      if (!value || (typeof value === "string" && !value.trim())) {
        alert("Please complete this field to continue.");
        return;
      }
      
      // Multi-input validation
      if (currentQuestion.type === "multi-input" && currentQuestion.subFields) {
        const missingFields = currentQuestion.subFields.filter(f => !value[f.id]);
        if (missingFields.length > 0) {
          alert(`Please complete: ${missingFields.map(f => f.label).join(", ")}`);
          return;
        }
      }

      // Legal Agreement Validation
      if (currentQuestion.type === "legal_agreement") {
        if (!value.signedName || !value.signedName.trim()) {
          alert("Please type your full name to sign the agreement.");
          return;
        }
      }
    }

    if (currentStep < QUESTIONS.length - 1) {
      setDirection(1);
      setCurrentStep(prev => prev + 1);
    } else {
      setIsComplete(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleInputChange = (id: string, value: any) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleMultiInputChange = (parentId: string, subId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [parentId]: {
        ...(prev[parentId] || {}),
        [subId]: value
      }
    }));
  };

  // Animation variants
  const variants = {
    enter: (direction: number) => ({
      y: direction > 0 ? 50 : -50,
      opacity: 0,
      scale: 0.95,
      filter: "blur(10px)"
    }),
    center: {
      zIndex: 1,
      y: 0,
      opacity: 1,
      scale: 1,
      filter: "blur(0px)"
    },
    exit: (direction: number) => ({
      zIndex: 0,
      y: direction < 0 ? 50 : -50,
      opacity: 0,
      scale: 0.95,
      filter: "blur(10px)"
    })
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex overflow-hidden font-sans selection:bg-primary/30">
      {/* Left Sidebar - Fixed */}
      <aside className="w-80 hidden lg:flex flex-col border-r border-white/5 bg-[#0a0a0a] p-8 relative z-10">
        <div className="mb-12">
          <h1 className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-blue-500 to-green-500 bg-clip-text text-transparent">
            olexum.
          </h1>
          <p className="text-muted-foreground text-sm mt-2 font-mono">System Initialization</p>
        </div>

        <div className="space-y-2 flex-1">
          {SECTIONS.map((section, index) => (
            <button
              key={section.id}
              onClick={() => {
                const firstQuestionIdx = QUESTIONS.findIndex(q => q.section === section.id);
                if (firstQuestionIdx !== -1) setCurrentStep(firstQuestionIdx);
              }}
              className="w-full text-left"
            >
              <SidebarItem 
                section={section} 
                isActive={index === currentSectionIndex} 
                isCompleted={index < currentSectionIndex}
              />
            </button>
          ))}
        </div>

        <div className="mt-auto pt-8 border-t border-white/5">
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            SECURE CONNECTION ACTIVE
          </div>
        </div>
      </aside>

      {/* Main Content - Scrollable */}
      <main className="flex-1 relative flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden p-6 border-b border-white/5 flex justify-between items-center bg-[#0a0a0a]">
          <span className="font-bold text-xl tracking-tighter bg-gradient-to-r from-blue-500 to-green-500 bg-clip-text text-transparent">olexum.</span>
          <span className="text-xs font-mono text-muted-foreground">Step {currentStep + 1}/{QUESTIONS.length}</span>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full px-6 py-12 lg:px-12 overflow-y-auto pb-32">
          {!isComplete && (
            <div className="mb-8">
              <span className="text-primary font-mono text-xs uppercase tracking-widest mb-2 block">
                {SECTIONS[currentSectionIndex].title}
              </span>
              <ProgressBar current={currentStep} total={QUESTIONS.length} />
            </div>
          )}

          <div className="relative min-h-[400px]">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={isComplete ? "complete" : currentStep}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  y: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
                className="w-full"
              >
                {isComplete ? (
                  <CompletionScreen onProceed={handleSubmission} />
                ) : (
                  <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-8 shadow-2xl glow-blue/5 backdrop-blur-sm">
                    <h2 className="text-3xl font-bold mb-3 tracking-tight">{currentQuestion.title}</h2>
                    <p className="text-muted-foreground text-lg mb-8 leading-relaxed">{currentQuestion.description}</p>

                    <div className="space-y-6">
                      {(currentQuestion.type === "text" || currentQuestion.type === "email" || currentQuestion.type === "tel") && (
                        <Input 
                          autoFocus
                          type={currentQuestion.type}
                          value={formData[currentQuestion.id] || ""}
                          onChange={(e) => handleInputChange(currentQuestion.id, e.target.value)}
                          placeholder={currentQuestion.placeholder}
                          className="bg-black/20 border-white/10 h-14 text-lg focus:border-primary/50 focus:ring-primary/20 transition-all"
                        />
                      )}

                      {currentQuestion.type === "number" && (
                        <Input 
                          autoFocus
                          type="number"
                          value={formData[currentQuestion.id] || ""}
                          onChange={(e) => handleInputChange(currentQuestion.id, e.target.value)}
                          placeholder={currentQuestion.placeholder}
                          className="bg-black/20 border-white/10 h-14 text-lg focus:border-primary/50 focus:ring-primary/20 transition-all"
                        />
                      )}

                      {currentQuestion.type === "textarea" && (
                        <Textarea 
                          autoFocus
                          value={formData[currentQuestion.id] || ""}
                          onChange={(e) => handleInputChange(currentQuestion.id, e.target.value)}
                          placeholder={currentQuestion.placeholder}
                          className="bg-black/20 border-white/10 min-h-[150px] text-lg focus:border-primary/50 focus:ring-primary/20 transition-all resize-none p-4"
                        />
                      )}

                      {currentQuestion.type === "select" && (
                        <div className="space-y-4">
                          <Select 
                            value={formData[currentQuestion.id]} 
                            onValueChange={(val) => handleInputChange(currentQuestion.id, val)}
                          >
                            <SelectTrigger className="bg-black/20 border-white/10 h-14 text-lg w-full">
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                              {currentQuestion.options?.map(opt => (
                                <SelectItem key={opt.value} value={opt.value} className="focus:bg-primary/20 focus:text-white cursor-pointer py-3">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {formData[currentQuestion.id] === "other" && (
                            <Input 
                              placeholder="Please specify..."
                              value={formData[`${currentQuestion.id}_other`] || ""}
                              onChange={(e) => handleInputChange(`${currentQuestion.id}_other`, e.target.value)}
                              className="bg-black/20 border-white/10 h-14 text-lg focus:border-primary/50 focus:ring-primary/20 transition-all"
                              autoFocus
                            />
                          )}
                        </div>
                      )}

                      {currentQuestion.type === "radio" && (
                        <div className="space-y-4">
                          <RadioGroup 
                            value={formData[currentQuestion.id]} 
                            onValueChange={(val) => handleInputChange(currentQuestion.id, val)}
                            className="grid gap-4"
                          >
                            {currentQuestion.options?.map(opt => (
                              <div key={opt.value} className={cn(
                                "flex items-center space-x-3 border border-white/10 rounded-xl p-4 cursor-pointer transition-all hover:bg-white/5",
                                formData[currentQuestion.id] === opt.value ? "border-primary bg-primary/5 glow-blue" : ""
                              )}>
                                <RadioGroupItem value={opt.value} id={opt.value} className="border-white/30 text-primary" />
                                <Label htmlFor={opt.value} className="text-lg cursor-pointer flex-1 font-normal">{opt.label}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                          {formData[currentQuestion.id] === "other" && (
                            <Input 
                              placeholder="Please specify..."
                              value={formData[`${currentQuestion.id}_other`] || ""}
                              onChange={(e) => handleInputChange(`${currentQuestion.id}_other`, e.target.value)}
                              className="bg-black/20 border-white/10 h-14 text-lg focus:border-primary/50 focus:ring-primary/20 transition-all"
                              autoFocus
                            />
                          )}
                        </div>
                      )}

                      {currentQuestion.type === "checkbox" && (
                        <div className="space-y-4">
                          {currentQuestion.options?.map(opt => (
                            <div key={opt.value} className="flex items-center space-x-3 border border-white/10 rounded-xl p-4 hover:bg-white/5 transition-all">
                              <Checkbox 
                                id={opt.value} 
                                checked={formData[currentQuestion.id] === opt.value}
                                onCheckedChange={(checked) => handleInputChange(currentQuestion.id, checked ? opt.value : "")}
                                className="border-white/30 data-[state=checked]:bg-primary data-[state=checked]:text-white"
                              />
                              <Label htmlFor={opt.value} className="text-lg cursor-pointer flex-1 font-normal">{opt.label}</Label>
                            </div>
                          ))}
                        </div>
                      )}

                      {currentQuestion.type === "legal_agreement" && (
                        <LegalAgreement
                          companyName={formData.company_name || ""}
                          contactName={formData.contact_info?.name || ""}
                          contactEmail={formData.contact_info?.email || ""}
                          onSign={(signatureData) => {
                            // Store the signature data in the form state
                            handleInputChange(currentQuestion.id, signatureData);
                          }}
                        />
                      )}

                      {currentQuestion.type === "multi-input" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {currentQuestion.subFields?.map(field => (
                            <div key={field.id} className={cn(field.width === "full" ? "md:col-span-2" : "md:col-span-1")}>
                              <Label className="text-xs font-mono text-muted-foreground uppercase mb-2 block ml-1">{field.label}</Label>
                              <Input 
                                type={field.type}
                                value={formData[currentQuestion.id]?.[field.id] || ""}
                                onChange={(e) => handleMultiInputChange(currentQuestion.id, field.id, e.target.value)}
                                placeholder={field.placeholder}
                                className="bg-black/20 border-white/10 h-12 focus:border-primary/50 focus:ring-primary/20 transition-all"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Buttons */}
          {!isComplete && (
            <div className="flex justify-between items-center mt-12 relative z-20 pt-4 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
              <Button 
                variant="ghost" 
                onClick={handleBack}
                disabled={currentStep === 0}
                className="text-muted-foreground hover:text-white hover:bg-white/5"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>

              <Button 
                onClick={handleNext}
                className="bg-primary hover:bg-primary/90 text-white px-8 h-12 rounded-full font-bold text-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all group font-sans"
              >
                {currentStep === QUESTIONS.length - 1 ? "Complete Setup" : "Next Step"}
                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
