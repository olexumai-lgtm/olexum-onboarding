import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, CreditCard, Check, ArrowRight, Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "calendar", title: "Schedule ROI Review", icon: Calendar },
  { id: "payment", title: "Activate Trial", icon: CreditCard },
];

export default function Setup() {
  const [currentStep, setCurrentStep] = useState("calendar");
  const [isBooked, setIsBooked] = useState(false);

  // Animation variants
  const fadeIn = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { duration: 0.3 }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex font-sans selection:bg-primary/30 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-white/10 bg-[#0a0a0a] flex flex-col p-8 z-20 hidden md:flex">
        <div className="mb-12">
          <div className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-blue-500 to-green-500 bg-clip-text text-transparent mb-2">
            olexum.
          </div>
          <div className="text-xs font-mono text-muted-foreground tracking-widest uppercase">
            System Activation
          </div>
        </div>

        <div className="space-y-6 relative">
          {/* Progress Line */}
          <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-white/5 -z-10" />
          
          {STEPS.map((step, index) => {
            const isActive = currentStep === step.id;
            const isCompleted = index < STEPS.findIndex(s => s.id === currentStep);
            const Icon = step.icon;

            return (
              <div 
                key={step.id}
                className={cn(
                  "flex items-center gap-4 transition-all duration-300 group cursor-pointer",
                  isActive ? "opacity-100" : isCompleted ? "opacity-60" : "opacity-40"
                )}
                onClick={() => {
                  if (isCompleted || isActive) setCurrentStep(step.id);
                }}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 bg-[#0a0a0a]",
                  isActive 
                    ? "border-blue-500 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" 
                    : isCompleted
                    ? "border-green-500 text-green-500 bg-green-500/10"
                    : "border-white/20 text-white/40"
                )}>
                  {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className={cn(
                  "font-medium tracking-wide text-sm",
                  isActive ? "text-white" : "text-muted-foreground"
                )}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-auto">
          <div className="flex items-center gap-2 text-[10px] text-green-500 font-mono">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            SECURE CONNECTION ACTIVE
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-[#0a0a0a]/50 backdrop-blur-xl z-10">
          <div className="text-sm font-mono text-muted-foreground">
            STEP {STEPS.findIndex(s => s.id === currentStep) + 1} / {STEPS.length}
          </div>
          <div className="flex items-center gap-4">
            {currentStep === "calendar" && (
              <Button 
                onClick={() => {
                  setIsBooked(true);
                  setCurrentStep("payment");
                }}
                className="bg-white text-black hover:bg-white/90 font-medium px-6"
              >
                I've Booked My Call <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          <div className="max-w-4xl mx-auto h-full">
            <AnimatePresence mode="wait">
              {currentStep === "calendar" && (
                <motion.div 
                  key="calendar"
                  {...fadeIn}
                  className="h-full flex flex-col"
                >
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Schedule Your ROI Data Review</h1>
                    <p className="text-muted-foreground">
                      Book your Day 15 review call. We'll analyze your agent's performance, lead quality, and ROI before your trial ends.
                    </p>
                  </div>
                  
                  <div className="flex-1 bg-white rounded-xl overflow-hidden shadow-2xl border border-white/10 h-[800px]">
                    <iframe 
                      src="https://api.leadconnectorhq.com/widget/booking/8MVMcn8UnvibbzfhQfXP" 
                      style={{ width: '100%', height: '100%', border: 'none', overflow: 'scroll' }} 
                      scrolling="yes" 
                      id="8MVMcn8UnvibbzfhQfXP_1769481170984"
                      title="Select a Date & Time"
                    ></iframe>
                    <script src="https://link.msgsndr.com/js/form_embed.js" type="text/javascript"></script>
                  </div>
                </motion.div>
              )}

              {currentStep === "payment" && (
                <motion.div 
                  key="payment"
                  {...fadeIn}
                  className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mb-8 glow-blue">
                    <Lock className="w-10 h-10 text-blue-500" />
                  </div>
                  
                  <h1 className="text-4xl font-bold mb-4">Activate Your 16-Day Trial</h1>
                  <p className="text-xl text-muted-foreground mb-12">
                    Secure your spot now. You won't be charged today.
                  </p>

                  <div className="w-full bg-[#111] border border-white/10 rounded-xl p-8 mb-8 text-left relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                    <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                      NO RISK GUARANTEE
                    </div>
                    
                    <div className="flex items-start gap-4 mb-6">
                      <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                        <Shield className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-1">100% Risk-Free Trial</h3>
                        <p className="text-sm text-muted-foreground">
                          We will review your ROI together on Day 15. If you're not satisfied, cancel instantly via your portal. No questions asked.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-white/5 pt-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Due Today</span>
                        <span className="font-mono font-bold text-green-500">$0.00</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">First Charge</span>
                        <span className="font-mono text-white">16 Days from Now</span>
                      </div>
                    </div>
                  </div>

                  <Button 
                    size="lg" 
                    className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_50px_rgba(37,99,235,0.5)] transition-all"
                    onClick={() => window.location.href = "https://buy.stripe.com/7sYbJ38Of9Q1gd84343wQ02"}
                  >
                    Proceed to Secure Checkout <ArrowRight className="ml-2" />
                  </Button>
                  
                  <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> 256-bit SSL Encrypted</span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span>Powered by Stripe</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
